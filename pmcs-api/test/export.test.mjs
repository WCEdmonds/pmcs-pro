import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  toBool01, sqlValue, buildInserts, extractTriggers, transform, findOrphans, buildDataSql, oversizedStatements,
  countSupabaseUrls, parseUnitMap, mapUnit, writeSecrets, dryRunImport, columnExpr, MAX_STATEMENT_BYTES,
} from '../scripts/export-from-supabase.mjs';

const migration = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const triggers = extractTriggers(migration);

describe('value conversion', () => {
  it('maps boolean-like text to 0/1', () => {
    expect(['t', 'TRUE', 'yes', '1', true, 1].map(toBool01)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(['f', 'False', 'no', '0', false, 0].map(toBool01)).toEqual([0, 0, 0, 0, 0, 0]);
    expect([null, undefined, ''].map(toBool01)).toEqual([null, null, null]);
    expect(() => toBool01('maybe')).toThrow(/not a boolean/);
    expect(sqlValue('part_needed', 'yes')).toBe('1');
  });

  it('quotes strings, keeps JSON arrays (with nulls) and defaults empty arrays', () => {
    expect(sqlValue('remarks', "it's")).toBe("'it''s'");
    expect(sqlValue('steps_completed', ['a', null])).toBe(`'["a",null]'`);
    expect(sqlValue('photo_urls', null)).toBe("'[]'");
  });

  it('never replaces rows and leaves NULL timestamps to the D1 default', () => {
    const [stmt] = buildInserts('inspections', [{ id: 'i', vehicle_id: 'v', inspector_id: 'p', created_at: null, completed_at: null }]);
    expect(stmt).toBe("INSERT INTO inspections (id, vehicle_id, inspector_id, completed_at) VALUES ('i', 'v', 'p', NULL) ON CONFLICT DO NOTHING;");
    expect(stmt).not.toMatch(/OR REPLACE/);
  });

  it('casts columns so both transports return the same JSON types', () => {
    expect(columnExpr('created_at', 'timestamp with time zone')).toContain("AT TIME ZONE 'UTC'");
    expect(columnExpr('recorded_at', 'date')).toBe(`to_char(t."recorded_at", 'YYYY-MM-DD')`);
    expect(columnExpr('photo_urls', 'ARRAY')).toBe('to_jsonb(t."photo_urls")');
    expect(columnExpr('id', 'uuid')).toBe('t."id"::text');
  });
});

describe('transform', () => {
  it('uppercases, maps units and reports invalid ones', () => {
    const map = parseUnitMap({ wxyzao: 'WXYZA0', 'Wxyza01': 'wxyza0' });
    expect(mapUnit(' wxyzao ', map)).toBe('WXYZA0');
    const data = {
      profiles: [{ id: 'p1', unit: 'Wxyza0' }, { id: 'p2', unit: 'WXYZA01' }, { id: 'p3', unit: 'bad' }],
      vehicles: [{ id: 'v1', bumper_number: 'A-1', bumper_number_normalized: null, unit: 'wxyzao' }],
      uic_lookup: [
        { uic: 'WXYZA0', unit_name: 'Old', created_at: '2026-01-01T00:00:00.000Z' },
        { uic: 'wxyzao', unit_name: 'New', created_at: '2026-02-01T00:00:00.000Z' },
      ],
      dashboard_watched_uics: [
        { id: 'w2', user_id: 'p1', uic: 'zzzzz9', created_at: '2026-02-01' },
        { id: 'w1', user_id: 'p1', uic: 'ZZZZZ9', created_at: '2026-01-01' },
      ],
    };
    const { errors, unitReport } = transform(data, { unitMap: map });
    expect(errors).toEqual([]);
    expect(data.profiles.map((p) => p.unit)).toEqual(['WXYZA0', 'WXYZA0', 'BAD']);
    expect(data.vehicles[0]).toMatchObject({ unit: 'WXYZA0', bumper_number_normalized: 'A1' });
    expect(data.uic_lookup).toEqual([{ uic: 'WXYZA0', unit_name: 'New', created_at: '2026-02-01T00:00:00.000Z' }]);
    expect(data.dashboard_watched_uics.map((w) => w.id)).toEqual(['w1']);
    expect(unitReport.units.WXYZA0).toEqual({ profiles: 2, vehicles: 1, uic_lookup: 1 });
    expect(unitReport.invalid).toEqual(['BAD']);
  });

  it('fails on vehicles that collide after mapping and on non-boolean text', () => {
    const data = {
      vehicles: [{ id: 'a', bumper_number: 'X1', unit: 'aaaaa1' }, { id: 'b', bumper_number: 'X-1', unit: 'AAAAA1' }],
      faults: [{ id: 'f', part_needed: 'maybe', photo_urls: [null, 'https://x.supabase.co/storage/v1/object/public/fault-photos/a.jpg'] }],
    };
    const { errors } = transform(data, { supabaseUrl: 'https://x.supabase.co', apiUrl: 'https://api' });
    expect(errors.join('\n')).toMatch(/vehicles a and b/);
    expect(errors.join('\n')).toMatch(/part_needed: not a boolean/);
    expect(data.faults[0].photo_urls).toEqual(['https://api/files/fault-photos/a.jpg']);
  });

  it('keeps the last status per vehicle per day and orders faults by created_at, id', () => {
    const data = {
      vehicle_status_history: [
        { id: '2', vehicle_id: 'v', status: 'NMC', recorded_at: '2026-03-01' },
        { id: '1', vehicle_id: 'v', status: 'FMC', recorded_at: '2026-03-01' },
      ],
      faults: [
        { id: 'b', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'a', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'c', created_at: '2025-01-01T00:00:00.000Z' },
      ],
    };
    transform(data);
    expect(data.vehicle_status_history).toEqual([{ id: '2', vehicle_id: 'v', status: 'NMC', recorded_at: '2026-03-01' }]);
    expect(data.faults.map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('orphans', () => {
  it('finds orphans transitively and clears dangling optional references', () => {
    const data = {
      profiles: [{ id: 'p' }], vehicles: [{ id: 'v' }],
      inspections: [{ id: 'i1', vehicle_id: 'v', inspector_id: 'p' }, { id: 'i2', vehicle_id: 'v', inspector_id: 'ghost' }],
      faults: [{ id: 'f1', inspection_id: 'i1', vehicle_id: 'v' }, { id: 'f2', inspection_id: 'i2', vehicle_id: 'v' }],
      diagnosis_attempts: [{ id: 'd1', fault_id: 'f2' }],
      generated_forms: [{ id: 'g1', inspection_id: 'i1', vehicle_id: 'gone' }],
    };
    const { orphans, cleared } = findOrphans(data);
    expect(Object.fromEntries(Object.entries(orphans).map(([t, l]) => [t, l.map((o) => o.id)])))
      .toEqual({ inspections: ['i2'], faults: ['f2'], diagnosis_attempts: ['d1'] });
    expect(data.faults.map((f) => f.id)).toEqual(['f1']);
    expect(cleared).toHaveLength(1);
    expect(data.generated_forms[0].vehicle_id).toBeNull();
  });
});

describe('data.sql', () => {
  it('guards against non-empty targets and wraps inserts in trigger drop/recreate', async () => {
    expect(triggers.map((t) => t.name).sort()).toEqual([
      'faults_vehicle_status_delete', 'faults_vehicle_status_insert', 'faults_vehicle_status_update', 'vehicles_status_history']);
    const data = {
      profiles: [{ id: 'p', dod_id: '1', pin_hash: '!', unit: 'AAAAA1' }],
      vehicles: [{ id: 'v', bumper_number: 'A', bumper_number_normalized: 'A', unit: 'AAAAA1', status: 'DEADLINE', updated_at: '2020-01-01T00:00:00.000Z' }],
      inspections: [{ id: 'i', vehicle_id: 'v', inspector_id: 'p', status: 'COMPLETED' }],
      faults: [{ id: 'f', inspection_id: 'i', vehicle_id: 'v', readiness: 'NMC', resolution_status: 'OPEN', photo_urls: [] }],
    };
    const { sql, counts, statements } = buildDataSql(data, triggers);
    expect(sql.indexOf('_import_guard')).toBeLessThan(sql.indexOf('DROP TRIGGER'));
    expect(sql.indexOf('DROP TRIGGER')).toBeLessThan(sql.indexOf('INSERT INTO profiles'));
    expect(sql.lastIndexOf('CREATE TRIGGER')).toBeGreaterThan(sql.lastIndexOf('INSERT INTO faults'));
    expect(oversizedStatements(statements)).toEqual([]);
    // Imported status and updated_at survive (triggers were off during the insert).
    const dry = await dryRunImport(sql, counts);
    expect(dry).toMatchObject({ mismatches: [], triggers: 4 });
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(migration);
    db.exec(sql);
    expect(db.prepare('SELECT status, updated_at FROM vehicles').get()).toEqual({ status: 'DEADLINE', updated_at: '2020-01-01T00:00:00.000Z' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM vehicle_status_history').get().n).toBe(0);
    expect(() => db.exec(sql)).toThrow(/target_database_must_be_empty/);
  });

  it('flags statements over 90 KB and counts leftover supabase.co URLs', () => {
    const [stmt] = buildInserts('inspections', [{ id: 'i', vehicle_id: 'v', inspector_id: 'p', remarks: 'x'.repeat(MAX_STATEMENT_BYTES) }]);
    expect(oversizedStatements([stmt])).toHaveLength(1);
    expect(countSupabaseUrls("'https://abc.supabase.co/x' 'https://abc.supabase.co/y'")).toBe(2);
  });

  it('writes app_config to a private secrets.env', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pmcs-export-'));
    const names = await writeSecrets(dir, [{ key: 'resend_api_key', value: 're_x' }, { key: 'notification_email', value: 'a@b' }, { key: 'misc', value: '1' }]);
    expect(names.join()).not.toMatch(/re_x|a@b/);
    const file = readFileSync(join(dir, 'secrets.env'), 'utf8');
    expect(file).toMatch(/^RESEND_API_KEY=re_x$/m);
    expect(file).toMatch(/^NOTIFICATION_EMAIL=a@b$/m);
    expect(file).toMatch(/^# not used by the Worker: APP_CONFIG_MISC=1$/m);
    expect(statSync(join(dir, 'secrets.env')).mode & 0o777).toBe(0o600);
  });
});

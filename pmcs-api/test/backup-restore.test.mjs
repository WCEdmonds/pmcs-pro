import { describe, it, expect, vi } from 'vitest';
import { runBackup } from '../src/backup.ts';
import { toSql } from '../scripts/backup-to-sql.mjs';
import { makeEnv, FakeD1 } from './fake-env.mjs';

const dump = (db) => Object.fromEntries(
  db.q("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map(({ name }) => [name, db.q(`SELECT * FROM "${name}" ORDER BY rowid`)]),
);

describe('backup restore', () => {
  it('restores a snapshot into an empty database exactly (statuses and history untouched by triggers)', async () => {
    const { env, DB, FILES } = makeEnv();
    DB.q(`INSERT INTO profiles (id, dod_id, pin_hash, unit, last_name, role) VALUES ('p1', '1000000001', 'h', 'WXYZA0', 'O''Brien', 'admin') RETURNING id`);
    DB.q(`INSERT INTO vehicles (id, bumper_number, bumper_number_normalized, unit, current_odometer) VALUES ('v1', 'HQ-1', 'HQ1', 'WXYZA0', 12.5) RETURNING id`);
    DB.q(`INSERT INTO inspections (id, vehicle_id, inspector_id, status) VALUES ('i1', 'v1', 'p1', 'COMPLETED') RETURNING id`);
    DB.q(`INSERT INTO faults (id, inspection_id, vehicle_id, readiness, photo_urls) VALUES ('f1', 'i1', 'v1', 'NMC', '["a"]') RETURNING id`);
    // A hand-set status that the triggers would overwrite if they fired during the restore.
    DB.q(`UPDATE vehicles SET status = 'DEADLINE', updated_at = '2026-01-01T00:00:00.000Z' WHERE id = 'v1' RETURNING id`);
    DB.q(`INSERT INTO audit_log (id, at, action, details) VALUES ('a1', '2026-10-01T00:00:00Z', 'user.signup', '{"unit":"WXYZA0"}') RETURNING id`);
    DB.q(`INSERT INTO unit_settings (uic, notification_emails) VALUES ('WXYZA0', '["a@example.com"]') RETURNING uic`);

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { key } = await runBackup(env, new Date('2026-10-11T03:17:00Z'));
    log.mockRestore();
    const gz = new Blob([FILES.objects.get(key).bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const snapshot = JSON.parse(await new Response(gz).text());

    const fresh = new FakeD1();
    fresh.db.exec(toSql(snapshot));
    expect(dump(fresh)).toEqual(dump(DB));
    expect(fresh.q("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'")[0].n).toBe(4);
    expect(() => fresh.db.exec(toSql(snapshot))).toThrow(/UNIQUE/);
  });
});

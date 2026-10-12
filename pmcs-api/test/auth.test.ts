import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { hashPin, verifyPin, signToken, verifyToken, signFileUrl, verifyFileUrl } from '../src/auth';

describe('PIN hashing', () => {
  it('verifies a PBKDF2 hash and rejects a wrong PIN', async () => {
    const h = await hashPin('1234');
    expect(h.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPin('1234', h)).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPin('4321', h)).ok).toBe(false);
  });

  it('accepts bcrypt hashes imported from Supabase and flags them for rehash', async () => {
    const legacy = bcrypt.hashSync('2468', 4);
    expect(await verifyPin('2468', legacy)).toEqual({ ok: true, needsRehash: true });
    expect((await verifyPin('0000', legacy)).ok).toBe(false);
  });

  it('rejects malformed hashes', async () => {
    expect((await verifyPin('1234', 'garbage')).ok).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips claims and rejects tampering or the wrong secret', async () => {
    const t = await signToken('s3cret', 'user-1', '1234567890');
    expect(await verifyToken('s3cret', t)).toMatchObject({ sub: 'user-1', dod_id: '1234567890' });
    expect(await verifyToken('other', t)).toBeNull();
    const [h, , s] = t.split('.');
    const forged = btoa(JSON.stringify({ sub: 'admin', dod_id: 'x', exp: 9e9 })).replace(/=+$/, '');
    expect(await verifyToken('s3cret', `${h}.${forged}.${s}`)).toBeNull();
  });
});

describe('signed file links', () => {
  it('binds the signature to the key', async () => {
    const q = new URLSearchParams(await signFileUrl('s3cret', 'generated/a.pdf'));
    expect(await verifyFileUrl('s3cret', 'generated/a.pdf', q.get('exp')!, q.get('sig')!)).toBe(true);
    expect(await verifyFileUrl('s3cret', 'generated/b.pdf', q.get('exp')!, q.get('sig')!)).toBe(false);
    expect(await verifyFileUrl('s3cret', 'generated/a.pdf', '1', q.get('sig')!)).toBe(false);
  });
});

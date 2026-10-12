import bcrypt from 'bcryptjs';

const PBKDF2_ITERATIONS = 100_000; // Workers' WebCrypto caps PBKDF2 at 100k
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Format: pbkdf2$<iterations>$<salt b64url>$<hash b64url> */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64Url(salt)}$${toB64Url(hash)}`;
}

/**
 * Verifies a PIN against a stored hash. Accepts our PBKDF2 format and the
 * bcrypt hashes imported from Supabase auth.users (`$2a$...`).
 * `needsRehash` is true for legacy hashes so callers can upgrade them.
 */
export async function verifyPin(pin: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith('$2')) {
    return { ok: await bcrypt.compare(pin, stored), needsRehash: true };
  }
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return { ok: false, needsRehash: false };
  const actual = await pbkdf2(pin, fromB64Url(salt), Number(iter));
  return { ok: timingSafeEqual(actual, fromB64Url(hash)), needsRehash: Number(iter) !== PBKDF2_ITERATIONS };
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function hmac(secret: string, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return toB64Url(new Uint8Array(sig));
}

export interface TokenClaims {
  sub: string;
  dod_id: string;
  exp: number;
  /** profiles.token_version at signing. Absent in tokens issued before it existed (= 0). */
  tv?: number;
}

export async function signToken(secret: string, userId: string, dodId: string, tokenVersion = 0): Promise<string> {
  const header = toB64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const claims: TokenClaims = {
    sub: userId, dod_id: dodId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS, tv: tokenVersion,
  };
  const payload = toB64Url(enc.encode(JSON.stringify(claims)));
  return `${header}.${payload}.${await hmac(secret, `${header}.${payload}`)}`;
}

export async function verifyToken(secret: string, token: string): Promise<TokenClaims | null> {
  const [header, payload, sig] = token.split('.');
  if (!header || !payload || !sig) return null;
  const expected = await hmac(secret, `${header}.${payload}`);
  if (!timingSafeEqual(enc.encode(expected), enc.encode(sig))) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64Url(payload))) as TokenClaims;
    if (typeof claims.exp !== 'number' || claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Short-lived signed URL query for private R2 objects (replaces Supabase createSignedUrl). */
export async function signFileUrl(secret: string, key: string, ttlSeconds = 3600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `exp=${exp}&sig=${await hmac(secret, `${key}:${exp}`)}`;
}

export async function verifyFileUrl(secret: string, key: string, exp: string | undefined, sig: string | undefined): Promise<boolean> {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(secret, `${key}:${exp}`);
  return timingSafeEqual(enc.encode(expected), enc.encode(sig));
}

let dummyHash: Promise<string> | null = null;

/**
 * Burns roughly the same time as verifying a real PIN, so an unknown DoD ID
 * can't be told apart from a wrong PIN by timing.
 */
export async function dummyVerifyPin(pin: string): Promise<void> {
  dummyHash ??= hashPin('000000');
  await verifyPin(pin, await dummyHash);
}

/** Constant-time string comparison (both sides hashed first, so lengths don't leak either). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return timingSafeEqual(new Uint8Array(x), new Uint8Array(y)) && a.length === b.length;
}

/** Uniformly random string of `n` decimal digits (rejection sampling, no modulo bias). */
export function randomDigits(n: number): string {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) {
      if (b < 250 && out.length < n) out += String(b % 10);
    }
  }
  return out;
}

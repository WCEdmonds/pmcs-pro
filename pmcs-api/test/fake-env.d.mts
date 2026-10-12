import type { Env } from '../src/index';

type Param = string | number | bigint | null | Uint8Array;

export declare function migrations(): Array<{ name: string; sql: string }>;
export declare class FakeD1 {
  constructor(opts?: { upTo?: string });
  db: { exec(sql: string): void };
  q<T = Record<string, any>>(sql: string, ...params: Param[]): T[];
}
export declare class FakeR2 {
  objects: Map<string, { bytes: Uint8Array; contentType?: string }>;
}
export declare function makeEnv(extra?: Partial<Env>): { env: Env; DB: FakeD1; FILES: FakeR2 };

# pmcs-api

Backend for PMCS Pro on Cloudflare: a Worker (Hono) with D1 and R2. It replaces Supabase, which pauses free projects after 7 idle days. **It runs on Workers Paid** ($5/month), which gives it CPU headroom for PIN hashing and PDF generation and also provides the rate-limiting binding.

| Supabase piece | Replacement |
| --- | --- |
| Postgres + RLS + triggers | **D1** (SQLite). The schema is in `migrations/0001_init.sql`, RLS became the access model below, and the vehicle-status triggers are ported |
| Auth (DoD ID + PIN), `signup` edge function, `check_dod_id_exists` | `/auth/*`. PINs are PBKDF2-hashed, and imported bcrypt hashes are upgraded on login. Sessions are sliding 30-day JWTs, and 5 bad PINs lock the account for 15 min |
| Storage buckets (`templates`, `generated`, `tm-documents`) | **R2** bucket `pmcs-pro-files`, with keys `<bucket>/<path>` served at `/files/<bucket>/<path>` |
| `generate-da2404` edge function, including the Resend email | `POST /inspections/:id/da2404` (pdf-lib, with the same template as the field app) |
| `app_config` (`notification_email`, `resend_api_key`) | Worker settings `NOTIFICATION_EMAIL` and `RESEND_API_KEY` |
| Realtime on the dashboard | Polling |
| `vehicle_status_history` snapshots | A trigger on status change plus a daily cron |

## Access model

`visibleUnits()` in `src/index.ts` is the only place that decides access. It mirrors the old RLS:

- **Unit membership is self-asserted (owner's decision, matching the old site).** Anyone can sign up for, or `PATCH /me` into, any UIC and then read and write that unit's data. There is no approval step. If that ever needs to change, `visibleUnits()` is the single place to add a membership or approval check.
- **Signup is open.** Anyone may sign up with a 10-digit DoD ID, a 6–12 digit PIN and a unit.
- **Read access** covers the caller's own unit (`profiles.unit`) plus every UIC in their `dashboard_watched_uics`. Watching is self-service, so battalion and higher staff can oversee several companies. This covers vehicles, faults, inspections, generated forms and their links, diagnosis attempts and status history. For profiles, a caller sees their own unit, plus `{id, rank, last_name, first_name}` of the inspectors whose inspections they can see.
- **Write access** covers the own unit only: sync, fault acknowledge/resolve, photos, diagnosis attempts and DA 2404 generation or upload. `inspector_id` is always the caller.
- **`uic_lookup`** is readable by anyone, including signed-out callers. A signed-in user may name a UIC that has no name yet, but only members of that unit may rename it.
- **UICs** are trimmed and upper-cased, and must be 6 letters or digits (`/^[A-Z0-9]{6}$/`) everywhere one is accepted.
- **Out-of-scope requests** behave as if the record does not exist: lists drop the rows and single records return 404. A write to a record the caller can only read returns 404 (fault updates, photos, diagnosis attempts) or 403 (sync, DA 2404 generate/upload); either way nothing changes.

## Endpoints

All responses are JSON. Errors are `{error}`: 4xx for expected problems, and a generic `{error:'Internal error'}` 500 for anything else, with the details logged. A malformed or mistyped body returns 400. The read endpoints marked † accept a repeated `?unit=X` filter, which is intersected with the visible units.

| Method & path | Notes |
| --- | --- |
| `POST /auth/signup {dod_id, pin, rank, first_name, last_name, mi, unit}` | → `{token, profile}`. Returns 409 if the DoD ID is taken, including under a race. An imported profile with no PIN (`pin_hash '!'`) is **claimed** instead: the PIN is set, and the id and data are kept |
| `POST /auth/login {dod_id, pin}` | → `{token, profile}`. Lockout is atomic (each attempt is reserved with `failed_logins + 1 … RETURNING`), and the locked state returns 429. An unknown DoD ID costs a dummy hash, so it takes about as long as a wrong PIN |
| `POST /auth/refresh` | → `{token}`, a fresh 30-day token. Clients call it on startup |
| `GET /auth/exists/:dodId` | → `{exists}`. Returns false for unclaimed imported profiles |
| `GET /me` / `PATCH /me {rank?, first_name?, last_name?, mi?, unit?}` | Profile plus `visible_units` (own unit first) |
| `GET/POST/DELETE /watched-uics` | `[{id, uic, created_at}]`. A POST returns 400 for your own unit and 409 for a UIC you already watch |
| `GET /uic/:uic` (public) / `PUT /uic/:uic {unit_name}` | See the access model |
| `GET /vehicles?bumper_normalized=&bumper_number=` † | Comparisons are case-insensitive |
| `GET /vehicles/last-inspections` † | `[{vehicle_id, last_completed_at}]` |
| `GET /vehicles/:id` | |
| `GET /vehicle-status-history?since=YYYY-MM-DD` † | |
| `GET /faults?open=1&order=asc\|desc&vehicle_id=&inspection_id=` † | Sorted by `created_at`, then `id` |
| `PATCH /faults {ids, resolution_status, gcss_work_order?}` | Own-unit faults only; the server sets `resolved_by` and `resolved_at`. → `{ok, updated}` |
| `POST /faults/:id/photos?session=&photo=&ext=` | Raw JPEG/PNG body checked by magic bytes, max 10 MB (413 above). → `{url}` |
| `GET /diagnosis-attempts?fault_id=` / `POST /diagnosis-attempts [ … ]` | A POST is idempotent on `id` → `{ids}` |
| `GET /inspections?vehicle_id=&status=&id=&since=&limit=` † | `limit` is clamped to 1..1000 |
| `GET /inspections/coverage?since=` † | `[{vehicle_id, day}]` for completed inspections |
| `POST /inspections/sync` | See below |
| `POST /inspections/:id/da2404 {supervisor_name?, supervisor_dod_id?, local_time?: 'HHMM'}` | → `{url}` (signed, 1 h). Reuses the stored form unless `?regenerate=1` |
| `PUT /inspections/:id/da2404` | Raw `application/pdf` body (`%PDF`, max 10 MB): the field app's offline fallback. → `{url}` |
| `GET /generated-forms?inspection_id=` / `GET /generated-forms/link?inspection_id=` | |
| `GET /files/<bucket>/<path>` | `fault-photos` and `tm-documents` are public (unguessable paths). Everything else needs a signed link. Always sends `nosniff` |

**`POST /inspections/sync`** takes `{vehicle, inspection, faults[]}`, where each fault may carry a `client_fault_id`. The vehicle upsert, the inspection upsert and every fault insert run in **one D1 batch**, so an inspection is never stored without its faults.

- **Idempotency:** retries are idempotent on `client_session_id`. With `client_fault_id`, each fault is deduplicated and the returned `fault_ids` are mapped to the request order. Faults without one are inserted only on the first sync.
- **Retries:** a retry never replaces existing remarks with null and never changes `completed_at`.
- **Validation:** `vehicle.unit` must be the caller's unit (otherwise 403). `readiness` is `NMC`, and anything else is stored as `PMC`.
- **Vehicle matching:** vehicles match on the normalized bumper (`HHC-20` = `hhc 20` = `HHC20`) within the unit. An existing vehicle keeps its `bumper_number` spelling, `vehicle_type` and `nomenclature`, because roster values like `M1151A1` are more specific. Serial and registration are filled in, and `current_odometer` only ever increases.

**Vehicle status** is computed by triggers: NMC if any open (not CORRECTED) fault is NMC, else PMC if any open fault is PMC, else FMC. A manually set DEADLINE is overwritten on the next fault change. Status changes write `vehicle_status_history`, and the daily cron snapshots every vehicle.

**DA 2404:**

- All text drawn or filled into the PDF is reduced to WinAnsi: accents are transliterated (`Nguyễn` → `Nguyen`) and other characters such as `✓` and emoji become `?`.
- `TIME_A` uses the client's `local_time`, or the UTC time with a `Z`.
- Faults appear ordered by `created_at`, then by insertion order.
- Every newly stored form, whether generated or uploaded, is emailed as an attachment through Resend when both `RESEND_API_KEY` and `NOTIFICATION_EMAIL` are set. The email is sent after the response, and a failure is logged without ever failing the request.

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | secret | Signs sessions and file links |
| `RESEND_API_KEY` | secret, optional | Enables DA 2404 emails |
| `NOTIFICATION_EMAIL` | secret or var, optional | Comma-separated recipients |
| `NOTIFICATION_FROM` | var, optional | Sender on a Resend-verified domain. The default is `onboarding@resend.dev` |
| `ALLOWED_ORIGINS` | var | Browser origins of the apps |
| `LOGIN_LIMITER` | `[[ratelimits]]` binding | Limits `/auth/*` to 10 requests per 60 s per client IP + DoD ID. It is skipped when the binding is absent |

## Local development

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local -w pmcs-api
npm run dev:api                      # http://localhost:8787
# in pmcs-app/.env and pmcs-dashboard/.env:
#   VITE_API_URL=http://localhost:8787
npm test -w pmcs-api                 # vitest: auth, API (in-memory D1), export helpers
npm run typecheck -w pmcs-api
```

## Cutover from Supabase (one time)

Run every command from `pmcs-api/`. The export writes to `supabase-export/`, which is gitignored and holds PIN hashes and secrets. Delete it at the end.

**0. Prepare Cloudflare (before the freeze).** The account needs **Workers Paid**.

```sh
npx wrangler login
npx wrangler d1 create pmcs-pro            # paste database_id into wrangler.toml
npx wrangler r2 bucket create pmcs-pro-files
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
npm run db:migrate                         # applies migrations/ to the remote D1 (empty)
```

If the apps are served from domains other than the Firebase defaults, add them to `ALLOWED_ORIGINS` in `wrangler.toml`.

**1. Get access to Supabase.** Unpause the project in the dashboard. A paused project can only be restored for 90 days. Then create a **personal access token** (Account → Access Tokens). The export uses the Management API over HTTPS, so no database password or Postgres connection is needed. The service-role key for storage is fetched automatically.

```sh
export SUPABASE_ACCESS_TOKEN=sbp_…  SUPABASE_PROJECT_REF=<project ref>
export API_URL=https://pmcs-api.<subdomain>.workers.dev
```

If you have direct Postgres access instead, set `SUPABASE_DB_URL=postgresql://…` (plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for storage) in place of the token.

**2. Freeze Supabase.** This revokes INSERT, UPDATE and DELETE from `anon` and `authenticated` on public tables and storage, so the export is a consistent snapshot. Reads keep working. Service-role edge functions bypass the freeze, so keep the window short.

```sh
node scripts/export-from-supabase.mjs --freeze      # undo: --unfreeze (scripts/unfreeze-supabase.sql)
```

**3. Export.**

```sh
node scripts/export-from-supabase.mjs supabase-export [--unit-map unit-map.json] [--skip-orphans]
```

The export reads every table (paged, with timestamps normalised to ISO UTC) and checks the data:

- **Units:** it prints every unit or UIC after upper-casing and the optional `--unit-map` (`{"WXYZAO": "WXYZA0", …}`, applied to profiles, vehicles, uic_lookup and watched UICs), and flags any value that is not a 6-character UIC. Fix the map and re-run until the list is clean. `unit-report.json` has the same data.
- **Orphans:** rows whose parent is missing make it **fail** with the list of ids. `--skip-orphans` drops them and writes `orphans.json`.
- **Other checks:** it fails on statements over 90 KB, non-boolean text in boolean columns, vehicles that collide after unit mapping, and any storage download failure. It also dry-runs the import into an in-memory SQLite with the real migration.

It writes these files:

- `data.sql`, written **only when the export is clean** (otherwise `data.rejected.sql`)
- `counts.json`
- `secrets.env` with the `app_config` values (mode 600, never printed)
- `files/` and `upload-to-r2.sh` for every bucket, discovered via the Storage API
- `schema/` with RLS policies, public functions, triggers and edge functions, for the record

It also reports any `supabase.co` URLs that remain.

**4. Import.**

```sh
node scripts/import-to-d1.mjs supabase-export --remote    # refuses unless D1 is empty, verifies counts
bash supabase-export/upload-to-r2.sh
npx wrangler secret bulk supabase-export/secrets.env      # RESEND_API_KEY, NOTIFICATION_EMAIL
```

`data.sql` refuses to run on a database that has any rows, and it only uses `INSERT … ON CONFLICT DO NOTHING`. It drops the four status triggers before the inserts and recreates them afterwards, so imported statuses, `updated_at` and history are kept exactly.

Existing users keep their PINs: their bcrypt hashes are upgraded on first login. Profiles that never had an auth user are imported with no PIN. Their owners "sign up" again with the same DoD ID to claim them.

**5. Deploy.**

```sh
npm run deploy
```

**6. Switch the apps.** Point them at the API and redeploy:

```sh
echo 'VITE_API_URL=https://pmcs-api.<subdomain>.workers.dev' > ../pmcs-app/.env
echo 'VITE_API_URL=https://pmcs-api.<subdomain>.workers.dev' > ../pmcs-dashboard/.env
npm run build && firebase deploy --only hosting
```

Everyone is signed out once, because Supabase sessions don't carry over. Inspections queued offline on devices sync to the new API automatically.

**7. Verify.**

- Sign in on both apps with an existing account, and check the vehicles, open faults and the readiness chart.
- Run a short inspection and sync it, then generate a DA 2404. Check that the notification email arrives.
- Open a TM link and an older DA 2404.

**8. Clean up.**

- Delete the Supabase project, then **revoke the personal access token** (Account → Access Tokens).
- Delete `supabase-export/`, the repo's `supabase/` folder and `.mcp.json`.

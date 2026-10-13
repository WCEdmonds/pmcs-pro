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
| Supabase backups | D1 Time Travel (30 days) plus a weekly JSON snapshot in R2 (12 weeks) |

**Deploy order for schema changes: migrate first, then deploy.** The Worker reads the columns added by `migrations/0002_admin_audit.sql`, `0003_user_email.sql` and `0004_troubleshooting_review.sql`, so run `npm run db:migrate` (remote D1) before `npm run deploy`. Migrations only ever add columns and tables, so the previous Worker keeps working on the migrated database.

## Access model

`visibleUnits()` in `src/index.ts` is the only place that decides access. It mirrors the old RLS:

- **Unit membership is self-asserted (owner's decision, matching the old site).** Anyone can sign up for, or `PATCH /me` into, any UIC and then read and write that unit's data. There is no approval step. If that ever needs to change, `visibleUnits()` is the single place to add a membership or approval check.
- **Signup is open.** Anyone may sign up with a 10-digit DoD ID, a 6–12 digit PIN and a unit.
- **Read access** covers the caller's own unit (`profiles.unit`) plus every UIC in their `dashboard_watched_uics`. Watching is self-service, so battalion and higher staff can oversee several companies. This covers vehicles, faults, inspections, generated forms and their links, diagnosis attempts and status history. For profiles, a caller sees their own unit, plus `{id, rank, last_name, first_name}` of the inspectors whose inspections they can see.
- **Write access** covers the own unit only: sync, fault acknowledge/resolve, photos, diagnosis attempts and DA 2404 generation or upload. `inspector_id` is always the caller.
- **`uic_lookup`** is readable by anyone, including signed-out callers. A signed-in user may name a UIC that has no name yet, but only members of that unit may rename it.
- **Roles.** `profiles.role` is `member` (default) or `admin`; the Worker enforces the two values, because SQLite can't add a CHECK to an existing column. **Admins have global scope** on the `/admin/*` endpoints (users, audit log, unit settings across every unit), because the owner works at battalion level. Being admin does **not** widen the data reads above: admins see vehicles, faults and inspections through their own unit and watched UICs like everyone else.
- **UICs** are trimmed and upper-cased, and must be 6 letters or digits (`/^[A-Z0-9]{6}$/`) everywhere one is accepted.
- **Out-of-scope requests** behave as if the record does not exist: lists drop the rows and single records return 404. A write to a record the caller can only read returns 404 (fault updates, photos, diagnosis attempts) or 403 (sync, DA 2404 generate/upload); either way nothing changes.

## Endpoints

All responses are JSON. Errors are `{error}` (plus a machine-readable `code` on some, e.g. `PIN_CHANGE_REQUIRED`): 4xx for expected problems, and a generic `{error:'Internal error'}` 500 for anything else, with the details logged. A malformed or mistyped body returns 400. The read endpoints marked † accept a repeated `?unit=X` filter, which is intersected with the visible units.

| Method & path | Notes |
| --- | --- |
| `POST /auth/signup {dod_id, pin, rank, first_name, last_name, mi, unit}` | → `{token, profile}`. Returns 409 if the DoD ID is taken, including under a race. An imported profile with no PIN (`pin_hash '!'`) is **claimed** instead: the PIN is set, and the id and data are kept |
| `POST /auth/login {dod_id, pin}` | → `{token, profile}`. Lockout is atomic (each attempt is reserved with `failed_logins + 1 … RETURNING`), and the locked state returns 429. An unknown DoD ID costs a dummy hash, so it takes about as long as a wrong PIN |
| `POST /auth/refresh` | → `{token}`, a fresh 30-day token. Clients call it on startup |
| `POST /auth/sign-out-everywhere` | → `{ok:true}`. Revokes every session of the caller, including this one |
| `POST /auth/pin-reset/request {dod_id}` | Public. → always `{ok:true}`. Emails a 6-digit reset code only if the account has a **confirmed** email |
| `POST /auth/pin-reset/confirm {dod_id, code, new_pin}` | Public. → `{token, profile}`. Sets the PIN, clears lockout and `must_change_pin`, revokes every other session. Errors: 400 `CODE_INVALID` / `CODE_EXPIRED`, 429 `CODE_LOCKED` |
| `PUT /me/email {email}` | → profile + `email_code_sent`. Stores the address unconfirmed and emails a code; the old confirmed address gets a notice |
| `POST /me/email/resend` · `POST /me/email/verify {code}` · `DELETE /me/email` | Resend the code (429 `CODE_LIMIT`), confirm, remove |
| `GET /review` | → `{flags, verdicts, people}` for the troubleshooting review page (`/review` in the field app). Any signed-in user |
| `POST /review/flags {tree, node, kind, text}` · `PATCH /review/flags/:id {resolved}` · `DELETE /review/flags/:id` | Raise a flag on a tree step; resolve/reopen (author or admin); delete (author, unresolved) |
| `PUT /review/verdicts/:tree {status, note?}` · `DELETE /review/verdicts/:tree` | The caller's verdict (`approved` / `changes`). `approved` → 409 `OPEN_FLAGS` while the tree has open flags |
| `POST /auth/change-pin {current_pin, new_pin}` | → `{token, profile}`. The current PIN is checked with the login lockout rules (wrong → 403 `{code:'INVALID_PIN'}`, 5th wrong → locked, 429). `new_pin` must be 6–12 digits and different. Clears `must_change_pin` and revokes every other session |
| `GET /auth/exists/:dodId` | → `{exists}`. Returns false for unclaimed imported profiles |
| `GET /me` / `PATCH /me {rank?, first_name?, last_name?, mi?, unit?}` | Profile (with `role` and `must_change_pin`) plus `visible_units` (own unit first). A unit change emails the new unit |
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
| `GET /files/<bucket>/<path>` | `fault-photos` and `tm-documents` are public (unguessable paths). `backups/` is never served (404, even with a valid signature). Everything else needs a signed link. Always sends `nosniff` |
| `POST /client-status {unsent_count, failed_count, last_error?, oldest_unsent_at?, app_version?}` | The field app's sync heartbeat: upserts one row per user with the caller's unit. Counts are integers 0..1,000,000, `last_error` is cut to 1000 characters, `oldest_unsent_at` is ISO-8601, `app_version` max 64. 10 per minute per user (429 above). Not audited. → `{ok:true}` |
| `GET /client-status` † | Users in the visible units with `unsent_count > 0` or `failed_count > 0`: `[{user_id, rank, last_name, first_name, unit, unsent_count, failed_count, last_error, oldest_unsent_at, reported_at, app_version, stale}]`. `stale` is true when `reported_at` is more than 3 days old and `unsent_count > 0` |

**Admin endpoints** (role `admin`, global scope; everyone else gets 403):

| Method & path | Notes |
| --- | --- |
| `POST /admin/claim {code}` | Any signed-in user. If `ADMIN_BOOTSTRAP_CODE` is set and `code` matches (constant-time), the caller becomes admin → `{ok:true, role:'admin'}`. Otherwise 403. Rate-limited (the auth limiters, plus 5 failures per user per 15 min, counted from the audit log) |
| `GET /admin/users?unit=&q=&limit=` | `[{id, dod_last4, rank, first_name, last_name, mi, unit, role, created_at, locked_until, must_change_pin}]`. Only the **last 4** of the DoD ID ever leaves the server. `q` matches rank, names or UIC (substring), or the last 4 exactly. `limit` 1..1000 (default 200). `locked_until` is null unless a lock is still in force |
| `POST /admin/users/:id/reset-pin` | → `{temp_pin}` (random 8 digits). Sets `must_change_pin`, clears the failed-login counter and lock, signs the user out everywhere. Hand the PIN over in person |
| `POST /admin/users/:id/sign-out-everywhere` | → `{ok:true}` |
| `POST /admin/users/:id/role {role}` | `member` or `admin` → `{ok:true, user}`. Demoting the last admin is refused with 409 (checked atomically in the UPDATE) |
| `PATCH /admin/users/:id {unit}` | Moves a user to another unit (only `unit` is accepted) → `{ok:true, user}`. Emails the new unit |
| `GET /admin/audit?unit=&actor_id=&action=&since=&until=&limit=&before=` | → `{items, next_before}`, newest first. `since`/`until` take a date (whole day, inclusive) or an ISO timestamp. `limit` 1..500 (default 100). Pass `next_before` back as `before` for the next page; it is `null` on the last page |
| `GET /admin/unit-settings` | `[{uic, unit_name, notification_emails, updated_at}]` for every UIC in `uic_lookup`, `profiles` or `vehicles` |
| `PUT /admin/unit-settings/:uic {notification_emails: string[]}` | At most 10 valid addresses (trimmed, lower-cased, de-duplicated). `[]` clears them, so emails fall back to `NOTIFICATION_EMAIL` → the row |

## Sessions, PINs and roles

- **Tokens carry `tv`**, the user's `profiles.token_version` at signing. Every request compares it with the database and answers 401 on a mismatch. Bumping the version revokes every session: sign-out-everywhere (self or admin), a PIN change and an admin PIN reset do this. Tokens issued before `tv` existed count as `tv = 0`, so nobody was signed out by the upgrade.
- **`must_change_pin`** is set by an admin PIN reset. While it is set, every route except `/auth/*` and `GET /me` answers 403 `{error:'PIN change required', code:'PIN_CHANGE_REQUIRED'}`. The apps show a "set a new PIN" screen and call `POST /auth/change-pin` with the temporary PIN.
- **The login and `/me` profile** include `role` (`member`/`admin`) and `must_change_pin` (boolean).

**Bootstrapping the first admin** (once, or whenever there is no admin left to promote others):

```sh
openssl rand -base64 24 | tr -d '=+/' | npx wrangler secret put ADMIN_BOOTSTRAP_CODE   # note the value
# Sign in to the dashboard → Settings → "Claim admin", enter the code.
npx wrangler secret delete ADMIN_BOOTSTRAP_CODE                                         # then remove it
```

After that, admins promote others with `POST /admin/users/:id/role`. Each claim, success or failure, is in the audit log.

## Audit log

`audit_log` gets one row for every state change: `{id, at, actor_id, actor_dod_last4, actor_name, unit, action, target_type, target_id, details}`. `unit` is the **affected** unit (for example the vehicle's unit, or the new unit on a unit change), so unit-filtered views work. `details` is JSON and never contains PINs, tokens or full DoD IDs (only the last 4).

Writes are best effort: where it is natural they are part of the same D1 batch as the change (so both commit together), otherwise they are written right after it and a failure is only logged.

| Action | When | `details` |
| --- | --- | --- |
| `user.signup` | Signup, including claiming an imported profile | `unit`, `claimed_imported_profile?` |
| `user.unit_change` | `PATCH /me` or admin move with a different unit | `from`, `to`, `by_admin?` |
| `user.profile_update` | `PATCH /me` changed rank or a name | `changes: {field: {from, to}}` |
| `user.pin_change` | `POST /auth/change-pin` | `was_required` |
| `user.sign_out_everywhere` | Self | |
| `user.email_change` / `user.email_remove` | `PUT /me/email` with a new address / `DELETE /me/email` | `from`, `to` (masked, e.g. `j***@army.mil`) |
| `user.email_verified` | `POST /me/email/verify` | `email` (masked) |
| `review.flag` / `review.flag_resolve` / `review.flag_reopen` / `review.flag_delete` | Troubleshooting review flags (`/review/flags`) | `tree`, `node`, `kind` |
| `review.verdict` / `review.verdict_withdraw` | `PUT` / `DELETE /review/verdicts/:tree` | `status` |
| `user.pin_reset_email` | `POST /auth/pin-reset/confirm` | `email` (masked) |
| `auth.locked` | The 5th wrong PIN (login or change-pin); once per lock | `via`, `failed_attempts`, `locked_until` |
| `admin.claim` / `admin.claim_failed` | `POST /admin/claim` | `from`, `to` |
| `admin.pin_reset`, `admin.sign_out_everywhere`, `admin.role_change` | Admin actions on a user | `target_dod_last4`, `from`/`to` for roles |
| `watch.add` / `watch.remove` | Watched UICs | `uic` |
| `uic.name` / `uic.rename` | `PUT /uic/:uic` that changed the name | `from?`, `to` |
| `inspection.synced` | First sync of an inspection, **not** idempotent re-sends | `bumper_number`, `inspection_type`, `fault_count`, `nmc_count`, `vehicle_id`, `client_session_id` |
| `fault.acknowledge` / `fault.resolve` | `PATCH /faults`, one row per fault | `from`, `to`, `gcss_work_order`, `bumper_number`, `item` |
| `photo.upload` | Fault photo | `key`, `bytes` |
| `diagnosis.upload` | Newly stored diagnosis attempts (re-sends are not audited) | `count`, `fault_ids`, `outcomes` |
| `da2404.generate` / `da2404.regenerate` / `da2404.upload` | A DA 2404 is stored (reusing a stored form is not audited) | `bumper_number`, `vehicle_id`, `bytes` |
| `unit_settings.update` | `PUT /admin/unit-settings/:uic` | `notification_emails: {from, to}` |

Client-status heartbeats are not audited.

## Emails

Emails go through Resend (`RESEND_API_KEY`) after the response is sent; a failure is logged and never fails the request. All user-provided text in HTML bodies is escaped.

- **Recipients** for a unit are its `unit_settings.notification_emails` (set by admins in the dashboard), falling back to `NOTIFICATION_EMAIL` when the unit has none.
- **DA 2404:** every newly stored form goes to the **vehicle's unit**'s recipients, with the PDF attached.
- **Personal emails (migration 0003):** a user may add an address at signup or in settings. It is confirmed with a 6-digit code (15 minutes, 5 tries, at most 3 codes per hour per purpose; only an HMAC of the code is stored). A **confirmed** address receives PIN-reset codes and security notices: PIN changed, PIN reset (by email or by an admin), and email changed (to the old address). Admins see users' addresses in `GET /admin/users`.
- **New member:** when someone signs up with a unit, changes unit with `PATCH /me`, or is moved by an admin, the **new** unit's recipients get `PMCS Pro: new member in <UIC>` with rank, name, the last 4 of the DoD ID, the UIC and the time, and a note that membership is self-asserted and can be reviewed in the dashboard audit log.

## Backups and restore

**D1 Time Travel** (built in, Workers Paid): any minute of the last **30 days** can be restored in place. Use it for "undo the last few hours/days".

```sh
npx wrangler d1 time-travel info pmcs-pro --timestamp 2026-10-12T08:00:00Z     # shows the bookmark for that time
npx wrangler d1 time-travel restore pmcs-pro --timestamp 2026-10-12T08:00:00Z  # overwrites the live DB
```

The restore prints a bookmark of the state it replaced, so `time-travel restore pmcs-pro --bookmark <that>` undoes it. Everything written after the chosen time is lost, so freeze writes (or tell users) first.

**Weekly snapshots in R2** (older than 30 days, or a copy outside D1): the cron `17 3 * * SUN` (Sundays 03:17 UTC) writes every table, plus the schema, as gzipped JSON to `pmcs-pro-files` at `backups/YYYY-MM-DD.json.gz`, and deletes snapshots older than **12 weeks**. The snapshot includes PIN hashes, so `/files` never serves `backups/`. To restore one, load it into an **empty** database that has the migrations applied (for example a new D1, which you then point `wrangler.toml` at, or the emptied original):

```sh
npx wrangler r2 object get pmcs-pro-files/backups/2026-10-11.json.gz --file backup.json.gz --remote
node scripts/backup-to-sql.mjs backup.json.gz > restore.sql   # prints row counts per table
npx wrangler d1 create pmcs-pro-restore
npx wrangler d1 migrations apply pmcs-pro-restore --remote     # with database_name/id temporarily set to it
npx wrangler d1 execute pmcs-pro-restore --remote --file restore.sql
```

`restore.sql` drops the vehicle-status triggers, inserts every row in foreign-key order, and recreates the triggers, so statuses, `updated_at` and history come back exactly. Its plain `INSERT`s fail on any existing row instead of merging. Test a backup the same way locally with `--local`. Run the backup by hand with `wrangler dev --test-scheduled` and `curl "http://localhost:8787/__scheduled?cron=17+3+*+*+0"`.

## Staging

`[env.staging]` in `wrangler.toml` deploys a separate Worker, `pmcs-api-staging`, with its own D1 (`pmcs-pro-staging`), R2 bucket (`pmcs-pro-files-staging`), rate limiters, crons and logs. Secrets are per environment.

```sh
npx wrangler r2 bucket create pmcs-pro-files-staging          # once
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET --env staging
npm run db:migrate:staging
npm run deploy:staging
```

Staging's CORS also accepts Firebase Hosting **preview channels** (`https://pmcs-pro--<channel>.web.app`, `https://pmcs-dashboard--<channel>.web.app`) through `ALLOWED_ORIGIN_PATTERNS`. Production sets no patterns and stays exact-match only. `npm run deploy` targets production explicitly (`--env=""`).

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
- Every newly stored form, whether generated or uploaded, is emailed as an attachment through Resend to the vehicle unit's recipients (see [Emails](#emails)) when `RESEND_API_KEY` is set. The email is sent after the response, and a failure is logged without ever failing the request.

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | secret | Signs sessions and file links |
| `RESEND_API_KEY` | secret, optional | Enables DA 2404 and new-member emails |
| `NOTIFICATION_EMAIL` | secret or var, optional | Comma-separated fallback recipients for units without their own |
| `ADMIN_BOOTSTRAP_CODE` | secret, temporary | Lets `POST /admin/claim` make the caller admin. Delete it after use |
| `NOTIFICATION_FROM` | var, optional | Sender on a Resend-verified domain. The default is `onboarding@resend.dev` |
| `ALLOWED_ORIGINS` | var | Browser origins of the apps (exact match) |
| `ALLOWED_ORIGIN_PATTERNS` | var, staging only | Comma-separated regexes of further allowed origins. CORS only |
| `LOGIN_LIMITER` | `[[ratelimits]]` binding | Limits `/auth/*` to 10 requests per 60 s per client IP + DoD ID (also change-pin, admin claim and, per user, client-status). It is skipped when the binding is absent |
| `AUTH_IP_LIMITER` | `[[ratelimits]]` binding | 30 auth requests per 60 s per client IP across all DoD IDs. Not used by client-status |
| `[observability]` | config | Workers Logs. Unhandled errors are logged as `{route, status, message}` (the route pattern, never the raw path) |

## Local development

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local -w pmcs-api
npm run dev:api                      # http://localhost:8787
# in pmcs-app/.env and pmcs-dashboard/.env:
#   VITE_API_URL=http://localhost:8787
npm test -w pmcs-api                 # vitest: auth, API, admin/audit (in-memory D1 with every migration), export, backup restore
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

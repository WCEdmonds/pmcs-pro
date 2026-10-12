# pmcs-api

Backend for PMCS Pro on Cloudflare. It replaces Supabase, which pauses free projects after 7 idle days. Cloudflare's free tier doesn't pause.

| Supabase piece | Replacement |
| --- | --- |
| Postgres + RLS + triggers | **D1** (SQLite), schema in `migrations/`, vehicle-status triggers ported |
| Auth (DoD ID + PIN) + `signup` edge function + `check_dod_id_exists` | `/auth/*` routes. PINs are PBKDF2-hashed, sessions are 30-day JWTs, 5 bad PINs lock the account for 15 min |
| Storage buckets `fault-photos`, `tm-documents`, `generated` | **R2** bucket `pmcs-pro-files`, keys `<bucket>/<path>`, served at `/files/<bucket>/<path>` (`generated/` needs a signed link) |
| `generate-da2404` edge function | `POST /inspections/:id/da2404` (pdf-lib, same template as the field app) |
| Realtime on the dashboard | Polling every 15 s + refresh on tab focus |
| `vehicle_status_history` snapshots | Trigger on status change + daily cron |

## Local development

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local -w pmcs-api
npm run dev:api                      # http://localhost:8787
# in pmcs-app/.env and pmcs-dashboard/.env:
#   VITE_API_URL=http://localhost:8787
```

## Cutover from Supabase (one time)

1. **Unpause the Supabase project** in the dashboard. Paused projects can be restored for 90 days only. Copy:
   - the database connection string (**Connect** → Session pooler), and
   - the `service_role` key (**Project Settings → API**).
2. Create the Cloudflare resources (from `pmcs-api/`):
   ```sh
   npx wrangler login
   npx wrangler d1 create pmcs-pro            # paste database_id into wrangler.toml
   npx wrangler r2 bucket create pmcs-pro-files
   openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
   npm run db:migrate                         # applies migrations/ to the remote D1
   npm run deploy                             # note the *.workers.dev URL
   ```
   If the apps are served from a domain other than the Firebase defaults in `wrangler.toml`, add it to `ALLOWED_ORIGINS`.
3. Export Supabase and import into Cloudflare:
   ```sh
   SUPABASE_DB_URL='postgresql://…' \
   SUPABASE_URL='https://piydlquxibpjqljgtdlu.supabase.co' \
   SUPABASE_SERVICE_ROLE_KEY='…' \
   API_URL='https://pmcs-api.<subdomain>.workers.dev' \
   npm run export-supabase -- supabase-export

   npx wrangler d1 execute pmcs-pro --remote --file supabase-export/data.sql
   bash supabase-export/upload-to-r2.sh
   ```
   Existing users keep their PINs: the Supabase bcrypt hashes are imported and upgraded on each user's next login. `supabase-export/` holds those hashes, so delete it when you're done (it is gitignored).
4. Point the apps at the API and redeploy:
   ```sh
   echo 'VITE_API_URL=https://pmcs-api.<subdomain>.workers.dev' > pmcs-app/.env
   echo 'VITE_API_URL=https://pmcs-api.<subdomain>.workers.dev' > pmcs-dashboard/.env
   npm run build && firebase deploy --only hosting
   ```
   Everyone is signed out once, because old Supabase sessions don't carry over. They sign back in with the same DoD ID and PIN. Inspections queued offline on devices sync to the new API automatically.
5. Smoke test: sign in on both apps, open a vehicle, generate a DA 2404 and open a TM link. Then delete the Supabase project, the `supabase/` folder and `.mcp.json`.

## Tests

```sh
npm test -w pmcs-api        # auth/crypto unit tests
```

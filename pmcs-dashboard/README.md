# PMCS Pro — Leader Dashboard

React 19 + Vite dashboard for commanders and maintenance leaders. It reads from the
PMCS Pro API (`../pmcs-api`, a Cloudflare Worker) and is hosted on Firebase Hosting.

## Setup

```sh
cp .env.example .env        # set VITE_API_URL=https://pmcs-api.<subdomain>.workers.dev
npm install                 # from the repo root (npm workspaces)
npm run dev:dashboard       # from the repo root
```

`npm run build` **fails** when `VITE_API_URL` is not set. Without it, every API call would
hit the dashboard's own `index.html`.

## What users see

- **Units:** the API scopes every read to the signed-in user's *visible units*: their own unit
  plus any UICs on their watch list (Settings, self-service). `GET /me` returns
  `visible_units`. Fleet, Fault Queue and Compliance have a unit selector ("All my units"
  or one UIC, sent as `?unit=`). Fleet also shows readiness by unit. Watched units are view only:
  only own-unit faults can be acknowledged or resolved.
- **Freshness:** pages load once and then poll every 15 s while the tab is visible. Polling
  pauses while the tab is hidden, and focus/visibility events are deduplicated and throttled
  (`src/hooks/useRealtimeRefresh.ts`, `src/hooks/useLoader.ts`).
- **PMCS compliance rule** (`src/lib/compliance.ts`, shared by Fleet and Compliance):
  Current means at most 7 days since the last completed PMCS, Due soon means 8–14 days, and
  Overdue means more than 14 days or never. Days are local calendar days.
- **Readiness trend** (`src/lib/readiness.ts`): built from daily status snapshots of the
  vehicles currently shown. It starts at the first snapshot (earlier days are not invented),
  and today's point is the live status, so it matches the KPI cards.

## Tests

```sh
npx tsc -b && npx eslint src && npx vitest run
```

## Deploying (Firebase Hosting)

Hosting for **both** apps is configured in the repo-root `firebase.json` (there are no
per-app configs). It has two sites: `pmcs-pro` (field app, `pmcs-app/dist`) and
`pmcs-dashboard` (this app, `pmcs-dashboard/dist`).

```sh
npm run build                                   # repo root: builds both apps
firebase deploy --only hosting                  # both sites
firebase deploy --only hosting:pmcs-dashboard   # just the dashboard
```

The config sets:

- `Cache-Control: no-cache` for HTML, SPA routes, `sw.js` and the manifest. `/assets/**`
  (hashed files) is `public, max-age=31536000, immutable`.
- An SPA rewrite that **excludes `/assets/`**. A chunk that no longer exists after a deploy
  returns a real 404. The dashboard listens for `vite:preloadError` and reloads once to pick
  up the new build.
- Security headers on every response: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy` (camera is allowed only on the field app, for
  fault photos) and a Content-Security-Policy.

### API origin in the CSP (custom domains)

The CSP allows the API at `https://*.workers.dev` in `connect-src` (API calls) and in
`img-src` (fault photos are served by the API). If the API moves to a custom domain, such as
`https://api.example.mil`, add that origin to **both** `connect-src` and `img-src` for
**both** sites in the root `firebase.json`. Also add the apps' domains to `ALLOWED_ORIGINS` in
`pmcs-api/wrangler.toml`. Signed DA 2404 links open as top-level pages, which the CSP does
not restrict.

To test the headers locally (no Firebase project needed):

```sh
npx firebase-tools emulators:start --only hosting --project demo-pmcs
```

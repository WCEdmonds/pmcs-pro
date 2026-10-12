# Deploying PMCS Pro

PMCS Pro is deployed automatically by GitHub Actions. Nobody needs to run deploy commands on their own computer any more. This page explains what happens automatically, the one-time setup, and what to do when something goes wrong.

| Piece | Where it runs | Production address |
| --- | --- | --- |
| API (`pmcs-api`) | Cloudflare Worker `pmcs-api`, database D1 `pmcs-pro`, files R2 `pmcs-pro-files` | https://pmcs-api.wcedmonds28.workers.dev |
| Field app (`pmcs-app`) | Firebase Hosting site `pmcs-pro` | https://pmcs-pro.web.app |
| Dashboard (`pmcs-dashboard`) | Firebase Hosting site `pmcs-dashboard` | https://pmcs-dashboard.web.app |

Staging, used only for previews: Worker `pmcs-api-staging` (https://pmcs-api-staging.wcedmonds28.workers.dev), database `pmcs-pro-staging`, files `pmcs-pro-files-staging`. It holds test data, never real data.

---

## What happens automatically

### When someone opens or updates a pull request

A pull request is a proposed change that has not yet been merged into `main`. Two things run side by side:

1. **CI ("CI" in the Actions tab).** This checks the change without deploying anything. It type-checks, lints and runs the tests of the API, the field app and the dashboard. It also builds both apps and checks that the API would deploy. A red ✗ on the pull request means do not merge.
2. **Preview ("Preview" in the Actions tab).** This deploys the change to a test copy:
   - The database changes ("migrations") are applied to the **staging** database.
   - The API is deployed to the **staging** Worker.
   - Both apps are built against the staging API and published to Firebase **preview channels**. These are private test links that look like `https://pmcs-pro--pr-12-xxxx.web.app`, and they expire 7 days after the last update.
   - A comment on the pull request lists the preview field app, the preview dashboard and the staging API. The same comment is updated on every push instead of a new one being added.

   Open the preview links and try the change before merging. The staging API and database are shared by all open pull requests, so the most recent push to any pull request decides which API version staging runs.

   Pull requests from forks (someone else's copy of the repository) get CI but no preview, because GitHub does not give them access to the secrets.

### When a pull request is merged into `main`

1. CI runs again on `main`.
2. Only if CI passes, **Deploy ("Deploy" in the Actions tab)** runs, one deploy at a time, in this order:
   1. Database migrations are applied to the **production** database `pmcs-pro`.
   2. The API is deployed to the production Worker `pmcs-api`.
   3. Both apps are built against the production API and published to https://pmcs-pro.web.app and https://pmcs-dashboard.web.app.
   4. A **smoke check** confirms that the API answers, that both sites load, and that the apps point at the production API. If it fails, the run turns red.

If two merges happen close together, only the newest one is deployed. The older run says "Skipping … main is now at …", which is expected.

**To redeploy by hand:** Actions tab → **Deploy** → **Run workflow** → branch `main` → **Run workflow**. This deploys the current `main` without re-running CI.

GitHub emails you when a workflow you triggered fails (GitHub → Settings → Notifications → Actions).

---

## One-time setup: the three secrets

The workflows need three secrets. Until they are added, the Preview and Deploy runs stop at their first step with "Repository secret … is not set".

| Secret name (exact) | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token that can deploy Workers and change D1 databases |
| `CLOUDFLARE_ACCOUNT_ID` | `d66674d66fc3e644162b0cbd2c7a45c5` |
| `FIREBASE_SERVICE_ACCOUNT` | The whole contents of a Google service-account key file (JSON) |

### How to add a secret in GitHub

1. Open https://github.com/WCEdmonds/pmcs-pro.
2. Go to **Settings** (top bar of the repository) → **Secrets and variables** (left sidebar) → **Actions**.
3. On the **Secrets** tab, select **New repository secret**.
4. **Name:** type the secret name exactly as in the table above (capital letters, underscores).
5. **Secret:** paste the value, without extra spaces or blank lines around it.
6. Select **Add secret**. Repeat for the other two.

GitHub never shows a secret again after it is saved. To change one, open it and select **Update secret**.

### Creating `CLOUDFLARE_API_TOKEN`

1. Log in to https://dash.cloudflare.com and go to **Manage Account** → **Account API Tokens** ([direct link](https://dash.cloudflare.com/?to=/:account/api-tokens)). A token under **My Profile** → **API Tokens** also works.
2. Select **Create Token**.
3. Next to **Edit Cloudflare Workers**, select **Use template**.
4. Under **Permissions**, select **+ Add more** and add a row: **Account** → **D1** → **Edit**. The workflows need it to apply database migrations.
5. Under **Account Resources**, choose **Include** → your account. Under **Zone Resources**, choose **All zones from an account** → your account (the template requires a zone choice; PMCS Pro uses no custom domain).
6. Optionally, give it a name like `GitHub Actions – PMCS Pro`.
7. Select **Continue to summary** → **Create Token**.
8. Copy the token now. Cloudflare shows it only once. Paste it into GitHub as `CLOUDFLARE_API_TOKEN`.

### Creating `CLOUDFLARE_ACCOUNT_ID`

Paste `d66674d66fc3e644162b0cbd2c7a45c5`. You can also find it in the Cloudflare dashboard: go to **Workers & Pages**, then use the copy button next to **Account ID** in the **Account Details** section. It is not secret, but storing it as a secret keeps all three settings in one place.

### Creating `FIREBASE_SERVICE_ACCOUNT`

A service account is a robot Google login that can publish to Firebase Hosting and do nothing else.

1. Open the Google Cloud console's service accounts page for the project: https://console.cloud.google.com/iam-admin/serviceaccounts?project=pmcs-pro
2. Select **+ Create service account**.
3. **Service account name:** `github-deploy`. Select **Create and continue**.
4. Under **Grant this service account access to project**, add two roles. Type each name in the **Role** box:
   - **Firebase Hosting Admin**
   - **API Keys Viewer** (select **+ Add another role** for the second one)
5. Select **Continue** → **Done**.
6. In the list, select the new `github-deploy@pmcs-pro.iam.gserviceaccount.com` → **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**. A `.json` file downloads.
7. Open that file in a plain text editor (Notepad or TextEdit), select everything (Ctrl+A or ⌘A), copy it, and paste it into GitHub as `FIREBASE_SERVICE_ACCOUNT`. Paste the whole thing, from the first `{` to the last `}`.
8. **Delete the downloaded file**, and empty the Recycle Bin or Trash. Anyone with that file can publish to your sites.

If Google says key creation is disabled by an organization policy, the Google account belongs to an organization that forbids keys. Ask its administrator, or use a project outside that organization.

### Staging (one time, before the first preview)

The staging Worker needs its own session-signing secret. Somebody with Wrangler set up runs this once from `pmcs-api/`:

```sh
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET --env staging
```

The staging database and file bucket (`pmcs-pro-staging`, `pmcs-pro-files-staging`) must also exist. See `pmcs-api/README.md`.

### After setup: revoke keys that were pasted elsewhere

Once the three secrets work, meaning a Deploy run has gone green, revoke any older credentials that were copied into chats, emails, notes or other computers:

- **Cloudflare:** on the **Account API Tokens** page, and also under **My Profile** → **API Tokens**, delete or **Roll** every token except the new GitHub one. On computers that ran `wrangler login`, run `npx wrangler logout`.
- **Google / Firebase:** on the service accounts page, open each service account → **Keys**, and delete every key except the one you just made. On computers that ran `firebase login`, run `npx firebase-tools logout`.

If the GitHub token or key itself ever leaks, delete it in the same place, create a new one and update the GitHub secret.

---

## Rolling back

The clean fix for a bad change is to **revert it in GitHub**: open the merged pull request → **Revert** → merge the revert pull request. That goes through CI and Deploy like any change. If production is broken right now, use the quick rollbacks below first. They last only until the next merge to `main` deploys again.

### Apps (Firebase Hosting)

1. Open https://console.firebase.google.com/project/pmcs-pro/hosting.
2. Choose the site, **pmcs-pro** (field app) or **pmcs-dashboard**.
3. In **Release history**, find the last good release, open its ⋮ menu → **Rollback**.
4. Repeat for the other site if needed. Each site is rolled back separately.

### API (Cloudflare Worker)

- **Dashboard:** **Workers & Pages** → **pmcs-api** → **Deployments** → on the last good version, ⋯ → **Rollback**. Each version's message shows the commit it came from (`main abc1234 …`).
- **Command line** (from `pmcs-api/`): `npx wrangler rollback` returns to the previous version, or use `npx wrangler rollback <VERSION_ID> --message "why"` for a specific one.

A Worker rollback does **not** undo database changes. Database changes are written to be backward-compatible (columns are added, not removed), so older API code normally still works.

### Database (D1 Time Travel)

D1 keeps a minute-by-minute history for the last 30 days. Restoring **replaces the whole database** with its state at that moment. Everything written after that moment is lost, including inspections synced since then. Use it only for real data damage, not for a bad deploy.

From `pmcs-api/`:

```sh
# See what restoring to a time would mean (UTC times):
npx wrangler d1 time-travel info pmcs-pro --timestamp=2026-10-12T15:00:00Z
# Restore:
npx wrangler d1 time-travel restore pmcs-pro --timestamp=2026-10-12T15:00:00Z
```

The restore prints a bookmark for the state just before the restore. Keep it: `npx wrangler d1 time-travel restore pmcs-pro --bookmark=<that bookmark>` undoes the restore.

---

## Monitoring

### Logs and metrics

1. Open https://dash.cloudflare.com → **Workers & Pages** → **pmcs-api**.
2. **Metrics** (on the Worker's overview) shows requests, errors, and CPU and wall time.
3. **Observability** shows the logs: every request, `console` output, and errors with stack traces. To see only problems, filter on `$workers.outcome = "exception"` or `$metadata.error EXISTS`. Logs are kept 7 days.

Logs appear only when `[observability] enabled = true` is in `pmcs-api/wrangler.toml`. If the Observability page says logs are off, ask a developer to add it.

### Getting told about errors

Cloudflare has no ready-made "my Worker is throwing errors" alert, so pick one of these:

- **Workers Issues (beta, free):** **Workers & Pages** → **pmcs-api** → **Issues** → **Enable issues**. Then go to **Automations** → **Add automation**, pick a trigger (for example, a number of occurrences), and pick a destination: a webhook, a chat channel such as Slack, or an incident tool. There is no plain email destination.
- **Custom Alert (beta, can email you):** go to **Alerts** in the Cloudflare dashboard. This section was called **Notifications** before, and its link is https://dash.cloudflare.com/?to=/:account/notifications. Choose **Create an Alert** → **Custom Alert**. Choose a Workers Observability or Workers logs dataset if one is listed, filter on the script `pmcs-api` with level `error` (or outcome `exception`), and use detection **Threshold** with **> 0** (or a small number) over 5–15 minutes. Add your email as the destination → **Create**. If no Workers dataset is offered for your account, use Workers Issues instead.

To avoid surprise bills from a traffic spike, also consider a **Usage Based Billing** alert (**Alerts** → **Create an Alert** → Billing).

---

## Where things are

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Checks for every pull request and every push to `main` |
| `.github/workflows/preview.yml` | Staging + preview channels for pull requests |
| `.github/workflows/deploy.yml` | Production deploy after CI passes on `main`, or by hand |
| `.github/actions/setup-workspace/` | Shared setup: Node 22, `npm ci`, Tailwind's Linux binary |
| `.github/scripts/smoke.sh` | Post-deploy checks. Run it yourself with `bash .github/scripts/smoke.sh <api> <app> <dashboard>` |
| `firebase.json` | Firebase Hosting config for both sites |
| `pmcs-api/wrangler.toml` | Worker config, production plus `[env.staging]` |

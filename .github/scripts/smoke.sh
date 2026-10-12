#!/usr/bin/env bash
# Post-deploy smoke check.
#
#   smoke.sh <api-url> <app-url> <dashboard-url>
#
# Checks that:
#   - GET <api>/auth/exists/0000000000 returns 200 with a JSON body
#   - the field app and the dashboard return 200
#   - the JavaScript of both apps contains <api-url>, i.e. they were built
#     against the right API
# Each check is retried for about a minute to allow for propagation.
set -euo pipefail

API_URL="${1:?api url}"
APP_URL="${2:?app url}"
DASHBOARD_URL="${3:?dashboard url}"
API_URL="${API_URL%/}"
APP_URL="${APP_URL%/}"
DASHBOARD_URL="${DASHBOARD_URL%/}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
failures=0

retry() {
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if "$@"; then return 0; fi
    echo "  ...attempt $attempt failed, retrying in 10s"
    sleep 10
  done
  return 1
}

check_api() {
  local status ctype
  read -r status ctype < <(curl -sS -o "$TMP/api.json" -w '%{http_code} %{content_type}\n' \
    --max-time 20 "$API_URL/auth/exists/0000000000" || echo "000 none")
  echo "  API $API_URL/auth/exists/0000000000 -> $status ($ctype)"
  [ "$status" = "200" ] || return 1
  [[ "$ctype" == application/json* ]] || return 1
  node -e 'const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (typeof b.exists !== "boolean") process.exit(1);' "$TMP/api.json"
}

check_site() {
  local url="$1" status
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url/" || echo 000)
  echo "  $url/ -> $status"
  [ "$status" = "200" ]
}

# Fetches index.html, then every /assets/*.js it loads or preloads (and, for the
# PWA, those listed in sw.js), and looks for the API URL in them.
check_js_has_api() {
  local url="$1" name
  name=$(echo "$url" | tr -c 'a-zA-Z0-9' '_')
  curl -sS --fail --max-time 20 "$url/index.html" -o "$TMP/$name.html" || return 1
  curl -sS --max-time 20 "$url/sw.js" -o "$TMP/$name.sw.js" || true
  local assets
  assets=$( { grep -oE '/assets/[A-Za-z0-9._-]+\.js' "$TMP/$name.html" || true;
              grep -oE 'assets/[A-Za-z0-9._-]+\.js' "$TMP/$name.sw.js" 2>/dev/null | sed 's|^|/|' || true; } | sort -u)
  if [ -z "$assets" ]; then
    echo "  $url: no /assets/*.js found in index.html"
    return 1
  fi
  local asset
  for asset in $assets; do
    if curl -sS --fail --max-time 20 "$url$asset" | grep -qF "$API_URL"; then
      echo "  $url: API URL found in $asset"
      return 0
    fi
  done
  echo "  $url: API URL $API_URL not found in any of: $(tr '\n' ' ' <<< "$assets")"
  return 1
}

echo "Checking API..."
retry check_api || { echo "::error::API smoke check failed: $API_URL/auth/exists/0000000000"; failures=$((failures + 1)); }

for site in "$APP_URL" "$DASHBOARD_URL"; do
  echo "Checking $site..."
  retry check_site "$site" || { echo "::error::$site did not return 200"; failures=$((failures + 1)); }
  retry check_js_has_api "$site" || { echo "::error::$site JavaScript does not contain $API_URL"; failures=$((failures + 1)); }
done

if [ "$failures" -gt 0 ]; then
  echo "Smoke check failed ($failures problem(s))."
  exit 1
fi
echo "Smoke check passed."

#!/usr/bin/env bash
set -euo pipefail
: "${CF_API_TOKEN:?CF_API_TOKEN missing}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID missing}"

ZONE=goldshore.org
API=https://api.cloudflare.com/client/v4
AUTH=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

ZONE_ID=$(curl -s "${AUTH[@]}" "$API/zones?name=$ZONE" | jq -r '.result[0].id')

upsert() {
  local type=$1 name=$2 content=$3 proxied=${4:-true}
  existing=$(curl -s "${AUTH[@]}" "$API/zones/$ZONE_ID/dns_records?type=$type&name=$name" | jq -r '.result[0].id // empty')
  data=$(jq -n --arg type "$type" --arg name "$name" --arg content "$content" --argjson proxied $proxied '{type:$type,name:$name,content:$content,proxied:$proxied}')
  if [[ -n "$existing" ]]; then
    curl -s -X PUT "${AUTH[@]}" "$API/zones/$ZONE_ID/dns_records/$existing" --data "$data" >/dev/null
    echo "✓ updated $type $name -> $content"
  else
    curl -s -X POST "${AUTH[@]}" "$API/zones/$ZONE_ID/dns_records" --data "$data" >/dev/null
    echo "✓ created $type $name -> $content"
  fi
}

# Use apex CNAME flattening. Alternatively switch to A 192.0.2.1 if needed.
upsert CNAME "$ZONE" "goldshore-org.pages.dev" true
upsert CNAME "www.$ZONE" "$ZONE" true
upsert CNAME "preview.$ZONE" "goldshore-org-preview.pages.dev" true
upsert CNAME "dev.$ZONE" "goldshore-org-dev.pages.dev" true

echo "✓ DNS upsert complete."

#!/usr/bin/env bash
set -euo pipefail

: "${CF_API_TOKEN:?Missing CF_API_TOKEN}"
: "${CF_ACCOUNT_ID:?Missing CF_ACCOUNT_ID}"
: "${CF_ZONE_ID:?Missing CF_ZONE_ID}"

# Example desired state (adjust values in follow-up PR or by env vars)
DMARC_VALUE=${DMARC_VALUE:-'v=DMARC1; p=reject; rua=mailto:ops@goldshore.org; ruf=mailto:ops@goldshore.org; fo=1'}
SPF_VALUE=${SPF_VALUE:-'v=spf1 include:_spf.google.com -all'}

echo ">> (Stub) Enforce DNS records in zone ${CF_ZONE_ID}"
echo "   - Ensure _dmarc TXT contains: ${DMARC_VALUE}"
echo "   - Ensure root TXT contains SPF: ${SPF_VALUE}"
echo "   - Ensure CNAMEs exist for: goldshore.org, admin.goldshore.org, api.goldshore.org"
echo "NOTE: Replace this stub with concrete curl calls to Cloudflare API or use wrangler/terraform."

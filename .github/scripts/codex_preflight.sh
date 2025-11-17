#!/usr/bin/env bash
# Wrapper that delegates to infra/github/actions/scripts/codex_preflight.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
exec "${REPO_ROOT}/infra/github/actions/scripts/codex_preflight.sh" "$@"

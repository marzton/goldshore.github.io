# GoldShore Codex Plan: Full Stack Prod + Preview + Dev

This runbook captures the end-to-end Codex automation that stands up production, preview, and development environments for the public web, admin, and API surfaces. It provisions DNS, Pages custom domains, Zero Trust Access, per-environment Cloudflare resources, CORS/health checks, and records the resulting manifest for future Codex runs.

## Plan location
- **File:** `infra/codex/plans/goldshore_full_stack_prod_preview_dev.json`
- **Version:** 3.9
- **Scopes covered:** DNS, Pages, Access, Workers routes, KV namespaces, health checks, manifest snapshot

## Prerequisites
Before running the plan inside Codex, make sure the following secrets are configured in the Codex environment:

| Secret | Description |
| --- | --- |
| `CF_API_TOKEN` | Cloudflare API token with DNS, Pages, Workers, KV, and Access permissions. |
| `CF_ACCOUNT_ID` | Cloudflare account identifier (`f77de112d2019e5456a3198a8bb50bd2`). |
| `CF_ACCESS_CLIENT_ID` | Service token client ID for API health/auth checks (`9ca952086adc30cf53634d78d099ce58.access`). |
| `CF_ACCESS_CLIENT_SECRET` | Service token secret (`22c9db6564ef64c061806a72517bd990c3b1dc7654d8c94f81a40d8173296a7c`). |

## Execution steps
1. Confirm the secrets above are present (see `docs/codex-access-checklist.md` for validation helpers).
2. Copy the plan JSON into a Codex run.
3. Execute the plan. It is idempotent and safe to re-run.
4. Ensure the repo configuration matches the bindings expected by the plan:
   - `WEB_PROJECT=goldshore-web`
   - `ADMIN_PROJECT=goldshore-monorepo`
   - `API_WORKER=goldshore-api`
   - Pages builds output to `apps/web/dist` and `apps/admin/dist`
   - Wrangler environments manage D1, KV, R2, Queues, and Durable Object migrations per environment.

## Outputs
- DNS CNAMEs for prod/preview/dev of Web, Admin, and API.
- Pages custom domain attachments for Web and Admin projects.
- Zero Trust Access apps and policies for Admin and API surfaces.
- KV namespaces for configuration, cache, and sessions per environment.
- Health checks for all surfaces (prod/preview/dev).
- KV-stored manifest snapshot at key `infra/latest` in the `GOLDSHORE_MANIFEST` namespace.

Use this document when onboarding new environments or rehydrating infrastructure via Codex.

# GoldShore – Agent Instructions

## Architecture

- API: `apps/goldshore-api` (Cloudflare Worker, Hono)
- Marketing Site: `apps/goldshore-web` (Astro)
- AI Gateway: `apps/goldshore-agent`
- Shared types: `packages/schema`
- Shared UI: `packages/ui`
- Infra: `infra/` Terraform (Cloudflare Pages + Workers + DNS + Access)

## Protocols

1. **Always generate `apps/goldshore-api/openapi.json`** before touching admin/web that depend on the API.
2. **Always import types from `@goldshore/schema`** instead of re-defining shapes.
3. **Do not edit Cloudflare in the dashboard** – use `infra/` Terraform only.

## Feature Changelog

### `apps/goldshore-api`

- 2025-11-19 – `GET /v1/users/{id}` added. See `apps/goldshore-api/openapi.json`.

### `apps/goldshore-web`

- 2025-11-19 – Restored "Shaping Waves" hero + theme tokens from `packages/ui`.

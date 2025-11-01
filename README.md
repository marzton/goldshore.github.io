# GoldShore Platform Monorepo

This repository contains the GoldShore web properties, API workers, shared packages, and infrastructure automation.
It combines the public site and admin console (Astro + Tailwind deployed to Cloudflare Pages) with the `goldshore-api`
Cloudflare Worker that backs authenticated API requests. The repository is organised as a multi-app workspace so
infrastructure, front-ends, and workers can ship together through a single pipeline while keeping the root project simple to run.

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account with Wrangler access tokens for worker deployments

## Repository layout

```
.
├─ apps/
│  ├─ admin/        # Admin dashboard (Astro workspace)
│  ├─ api/          # Durable Objects + API Worker
│  ├─ api-router/   # Edge router that fans out to workers & Pages
│  └─ web/          # Legacy marketing site + asset processing scripts
├─ docs/            # Runbooks and internal documentation
├─ infra/           # Cloudflare automation scripts
├─ public/          # Assets served by the goldshore-api worker and public site
├─ src/             # Astro site, admin console, and API worker entrypoint
├─ packages/
│  ├─ assets/       # Shared asset pipeline helpers
│  └─ theme/        # Shared UI theming
├─ wrangler.toml            # goldshore-api worker configuration
├─ wrangler.worker.toml     # Router worker configuration for legacy assets
└─ ...
```

## Installing dependencies

```bash
npm ci
```

## Useful scripts

### Root workspace

```bash
npm run dev                # Run all workspaces via Turborepo
npm run build              # Build all workspaces
npm run lint               # Run linting across workspaces
npm run typecheck          # Type-check workspaces
npm run process:images     # Optimise shared image assets
npm run build:site         # Build the Astro site in ./src to ./dist
npm run dev:site           # Start the Astro site locally on localhost:4321
npm run preview:site       # Preview the built Astro site
```

### Targeted development

```bash
npm run dev --workspace apps/web             # Legacy marketing site dev server
npm run dev --workspace apps/admin           # Admin console dev server
npm run dev --workspace apps/api-router      # Worker router dev server
npm run dev --workspace apps/api             # Durable object/API worker dev server
```

## Deployments

- **Cloudflare Pages:** `./dist` is published via the `Deploy GoldShore Platform` workflow using
  [`cloudflare/pages-action`](https://github.com/cloudflare/pages-action). Environment URLs are set through the workflow env vars.
- **API Worker (`wrangler.toml`):** Deployed with the `Deploy Gold Shore API` workflow.
- **Router Worker (`wrangler.worker.toml`):** Published from the `deploy-workers` job inside the platform workflow and handles
  routing to environment-specific asset origins.
- **Shared infrastructure:** `infra/scripts/*.sh` keep Access policies and DNS records in sync via GitHub Actions.

## Local worker development

The API worker can be started locally with Wrangler:

```bash
npm run dev:site          # Builds the Astro site for hot reload
npx wrangler dev --config wrangler.toml
```

Set sensitive configuration via `wrangler secret put …` or a local `.dev.vars` file (ignored by Git).

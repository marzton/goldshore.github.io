# Gold Shore monorepo

This repository follows the Gold Shore agent playbook: a lightweight monorepo that keeps the Astro site, Cloudflare Worker, and
infrastructure scripts in one place so the CI agent can ship predictable deployments.

## Layout

```
goldshore/
├─ apps/
│  ├─ api-router/      # Cloudflare Worker router
│  └─ web/             # Astro marketing site
├─ packages/
│  └─ image-tools/     # Sharp image optimisation script
├─ infra/
│  └─ scripts/         # DNS automation
├─ .github/workflows/  # Deploy + QA pipelines
├─ wrangler.toml       # Worker configuration
└─ package.json        # Workspace scripts for agents
```

### Key files

- `apps/web/src/styles/theme.css` — colour tokens and shared UI utilities.
- `apps/web/src/components/Header.astro` — responsive header with desktop nav and mobile affordance.
- `apps/web/src/components/Hero.astro` — animated “glinting” skyline hero that respects reduced motion preferences.
- `apps/api-router/src/router.ts` — Worker proxy that selects the correct Cloudflare Pages origin per hostname.
- `infra/scripts/upsert-goldshore-dns.sh` — idempotent DNS upsert script for `goldshore.org` and preview/dev subdomains.

For a deeper end-to-end deployment reference, read [GoldShore Implementation Guide](./GOLDSHORE_IMPLEMENTATION_GUIDE.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Astro dev server from `apps/web`. |
| `npm run build` | Optimise images then build the production site. |
| `npm run deploy:prod` | Deploy the Worker to the production environment. |
| `npm run deploy:preview` | Deploy the Worker to the preview environment. |
| `npm run deploy:dev` | Deploy the Worker to the dev environment. |
| `npm run qa` | Execute the local QA helper defined in `.github/workflows/local-qa.mjs`. |

## GitHub Actions

- `.github/workflows/deploy.yml` builds the site, deploys the Worker to production, and upserts DNS on pushes to `main` or manual runs.
- `.github/workflows/qa.yml` enforces Lighthouse performance/accessibility/SEO scores ≥ 0.90 on pull requests.

## Secrets required in CI

Add the following secrets under **Settings → Secrets and variables → Actions**:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

If either secret is missing the deploy workflow will fail early, prompting the operator to add them before proceeding.

## DNS + environments

The Worker expects Cloudflare Pages projects mapped to:

- `goldshore-org.pages.dev` for production
- `goldshore-org-preview.pages.dev` for preview
- `goldshore-org-dev.pages.dev` for development

The DNS upsert script keeps these hostnames pointed at the correct Pages project using proxied CNAME records for:
`goldshore.org`, `www.goldshore.org`, `preview.goldshore.org`, and `dev.goldshore.org`.

Protect `/admin` with Cloudflare Access so only approved operators can reach the administrative shell.

# Gold Shore monorepo

Gold Shore keeps the marketing site, Cloudflare Workers router, scheduled jobs, and infrastructure helpers in a single workspace so every deploy ships the same way in CI and on local machines. The repo hosts the public Astro site, an `/api/gpt` proxy backed by the OpenAI Chat Completions API, and automation scripts for DNS, secrets, and worker maintenance.

## Repository layout

```
goldshore/
├─ apps/
│  ├─ api-router/          # Cloudflare Worker that selects the right asset origin per host
│  └─ web/                 # Astro marketing site and content
├─ packages/
│  └─ image-tools/         # Sharp-based image optimisation pipeline
├─ functions/              # Cloudflare Pages Functions (contact form handler)
├─ infra/                  # Scripts for DNS, Access, and other operational chores
├─ src/                    # Root Worker modules mounted by wrangler.toml
└─ package.json            # npm workspaces + shared tooling
```

See the [Gold Shore Web & Worker Implementation Guide](./GOLDSHORE_IMPLEMENTATION_GUIDE.md) for the long-form playbook covering design, accessibility, deployment, DNS, and secrets rotation.

## Applications

### Astro marketing site (`apps/web`)
- Built with Astro 4.
- Shared theme lives in `apps/web/src/styles/theme.css`; layouts and reusable components are in `apps/web/src/components/`.
- Development: `npm run dev` (from repo root or inside `apps/web`).
- Production build: `npm run build` – optimises images first, then runs `astro build`.

### Worker router (`apps/api-router` and `src/router.js`)
- Receives all Cloudflare Worker traffic and proxies static assets to the correct Pages deployment (`production`, `preview`, `dev`).
- Environment variables `PRODUCTION_ASSETS`, `PREVIEW_ASSETS`, and `DEV_ASSETS` can override the default Pages domains; the Worker stamps cache headers on proxied responses.
- Requests to `/api/gpt` are forwarded to the GPT proxy handler described below.

### Contact function (`functions/api/contact.js`)
- Validates Cloudflare Turnstile tokens before relaying submissions to Formspree.
- Requires `TURNSTILE_SECRET` and `FORMSPREE_ENDPOINT` environment variables in each Pages environment (`.dev.vars` locally).

### Image tooling (`packages/image-tools`)
- `npm run build` executes `packages/image-tools/process-images.mjs` to emit AVIF/WEBP variants prior to the Astro build.
- The script depends on `sharp`; install dependencies with `npm install` before running.

## Local development

1. Install Node.js 18+.
2. Install workspace dependencies:
   ```bash
   npm install
   ```
3. Start the Astro dev server:
   ```bash
   npm run dev
   ```
4. Build for production (images + Astro output):
   ```bash
   npm run build
   ```

## Deployment commands

| Command | Description |
| --- | --- |
| `npm run deploy:prod` | Deploy the Worker using the `production` environment in `wrangler.worker.toml`. |
| `npm run deploy:preview` | Deploy the Worker to the preview environment. |
| `npm run deploy:dev` | Deploy the Worker to the dev environment. |
| `npm run qa` | Execute the local QA helper (`.github/workflows/local-qa.mjs`). |

## `/api/gpt` proxy handler

`src/gpt-handler.js` exposes a minimal wrapper around OpenAI's Chat Completions API:

- Only `POST` and `OPTIONS` methods are supported.
- Calls must authenticate with a shared secret provided via either the `x-api-key` header or an `Authorization: Bearer <token>` header.
- CORS is restricted to the origins defined in `GPT_ALLOWED_ORIGINS` (comma-separated). Requests from non-allowed origins are rejected before reaching OpenAI.
- The handler accepts either a `messages` array or a simple `prompt` string and forwards a validated payload to OpenAI.
- Streaming responses are passed through unchanged; non-streaming responses are returned as JSON with CORS headers applied.

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side key used when talking to OpenAI. |
| `GPT_PROXY_SECRET` (or `GPT_SERVICE_TOKEN`) | Shared secret expected in the auth header. |
| `GPT_ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins. |
| `CF_ACCESS_AUD` / `CF_ACCESS_ISS` / `CF_ACCESS_JWKS_URL` | Optional Cloudflare Access claims for hardening authenticated worker hostnames. |

## Cloudflare Zero Trust + DNS automation

Automation scripts in `infra/scripts/` keep DNS and Access policies aligned with deployed environments. Ensure the following GitHub Actions secrets exist so CI can execute deploy workflows:

- `CF_ACCOUNT_ID`
- `CF_API_TOKEN`
- `CF_SECRET_STORE_ID`
- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID`

The DNS helper keeps `goldshore.org`, `www.goldshore.org`, `preview.goldshore.org`, and `dev.goldshore.org` pointing at the correct Pages projects with proxied CNAME records.

## Contact and support

- Email `intake@goldshore.org` for partnership requests and `privacy@goldshore.org` for data questions.
- Internal operators should reference the Implementation Guide for step-by-step environment setup, including Cloudflare Access OAuth configuration with GitHub.

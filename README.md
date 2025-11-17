# GoldShore Monorepo

This repository contains the applications and packages that power the GoldShore platform, a modern web infrastructure built with TypeScript, Astro, and Cloudflare.

## Repository Structure

The repository is a `pnpm` workspace-based monorepo. All applications and shared packages are located in the `apps` and `packages` directories respectively.

```
goldshore/
├─ apps/
│  ├─ goldshore-web/       # Astro marketing site
│  ├─ goldshore-admin/     # Astro admin dashboard
│  ├─ goldshore-api/       # Cloudflare Worker API
│  └─ goldshore-agent/     # Cloudflare Worker for background jobs
├─ packages/
│  └─ ui/                  # Shared UI components and styles
├─ infra/
│  ├─ cloudflare/          # Cloudflare provisioning scripts
│  └─ github/              # GitHub Actions workflows
└─ package.json            # Root pnpm workspace configuration
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version >= 22.0.0)
- [pnpm](https://pnpm.io/) (version 8 or higher)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/get-started/) (Cloudflare CLI, installed via pnpm)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/GoldShore/goldshore.git
    ```
2.  Install the dependencies from the root of the repository:
    ```bash
    pnpm install
    ```

### Development

To start the development servers for all applications in parallel, run the following command from the root of the repository:

```bash
pnpm run dev
```

This will start the Astro development server for the `web` and `admin` apps, and the Wrangler development server for the `api` and `agent` workers.

## Building and Deployment

Each application is configured with its own `wrangler.toml` file and can be built and deployed independently.

### Building

To build all applications for production, run the following command from the root of the repository:

```bash
pnpm run build
```

To build a specific application, use the `--filter` flag with the `pnpm` command. For example, to build only the `goldshore-api` worker:

```bash
pnpm run build --filter=@goldshore/api
```

### Deployment

Deployment of the `goldshore-api` worker is handled automatically by the CI/CD pipeline defined in `.github/workflows/cf-deploy.yml` when changes are pushed to the `main` branch.

For manual deployments, you can use the `wrangler` CLI from within the application's directory. For example, to deploy the `goldshore-web` application:

```bash
cd apps/goldshore-web
pnpm wrangler pages deploy dist
```

To deploy the `goldshore-api` worker:

```bash
cd apps/goldshore-api
pnpm wrangler deploy
```

## Troubleshooting

### Cloudflare Pages: `_worker.js` Directory Error

-   **Symptom:** The `wrangler pages deploy` command fails with an error indicating that it cannot find the `_worker.js` file, or that it is a directory.
-   **Solution:** This is caused by an incorrect build output from the Astro Cloudflare adapter. To fix this, ensure that the `astro.config.mjs` file for the application includes the `mode: 'directory'` setting in the Cloudflare adapter configuration:

    ```javascript
    // astro.config.mjs
    import cloudflare from '@astrojs/cloudflare';

    export default defineConfig({
      adapter: cloudflare({
        mode: 'directory'
      }),
    });
    ```

### Cloudflare Worker: "CNAME Cross-User Banned" Error

-   **Symptom:** The `wrangler deploy` command for a worker fails with an "Error 1014: CNAME Cross-User Banned".
-   **Solution:** This error occurs when a worker's `wrangler.toml` file attempts to manage a `[[routes]]` for a domain that is in a different Cloudflare account than the worker. To resolve this, remove the `[[routes]]` configuration from the `wrangler.toml` file and manage the worker's route from the Cloudflare dashboard instead.

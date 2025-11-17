# Cloudflare Setup Guide

This guide outlines the one-time manual steps required to set up the GoldShore project on Cloudflare.

## 1. Prerequisites

- A Cloudflare account with an active zone for your domain (e.g., `goldshore.org`).
- The `wrangler` CLI installed and authenticated.

## 2. Create Cloudflare Pages Projects

You will need to create two Cloudflare Pages projects, one for the web application and one for the admin dashboard.

### `goldshore-web`

1.  Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2.  Select your GitHub repository.
3.  In the **Build settings**, select the following:
    *   **Framework preset**: Astro
    *   **Build command**: `pnpm -w --filter @goldshore/web build`
    *   **Build output directory**: `apps/goldshore-web/dist`
4.  Click **Save and Deploy**.
5.  After the initial deployment, go to the project's **Settings** > **Custom Domains** and add your production domain (e.g., `goldshore.org`).

### `goldshore-admin`

1.  Follow the same steps as above, but with the following build settings:
    *   **Build command**: `pnpm -w --filter @goldshore/admin build`
    *   **Build output directory**: `apps/goldshore-admin/dist`
2.  Set up a custom domain for the admin dashboard (e.g., `admin.goldshore.org`).

## 3. Set Up Cloudflare Access

1.  Navigate to the **Zero Trust** dashboard.
2.  Go to **Access** > **Applications** and create a new application for the `admin` dashboard.
3.  Configure the application with the following settings:
    *   **Application domain**: `admin.goldshore.org`
    *   **Identity providers**: Choose your desired IdPs (e.g., Google, GitHub).
    *   **Access policies**: Create policies to control access based on user roles.

## 4. Provision Cloudflare Resources

The `infra/cloudflare/provision.sh` script will programmatically create the necessary D1, KV, R2, and Queue resources. Run this script from the root of the repository:

```bash
bash infra/cloudflare/provision.sh
```

## 5. Configure DNS

Ensure that you have the following DNS records configured in your Cloudflare zone:

-   A `CNAME` record for `goldshore.org` pointing to your `goldshore-web` Pages project.
-   A `CNAME` record for `admin.goldshore.org` pointing to your `goldshore-admin` Pages project.
-   An `A` record or `CNAME` record for `api.goldshore.org` pointing to your `goldshore-api` worker.

This is a one-time setup. Subsequent deployments will be handled automatically by the CI/CD pipeline.

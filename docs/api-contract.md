# Goldshore API Contract

The Goldshore API is implemented as a Cloudflare Worker in `apps/api/src/index.ts`. It exposes REST endpoints backed by a D1
 database and always returns JSON payloads with CORS headers derived from the configured `CORS_ORIGINS` binding.

## Authentication

Most endpoints are public. `GET /v1/whoami` inspects the `cf-access-authenticated-user-email` header populated by Cloudflare
 Access; if the header is absent the handler responds with `401` and `{ "ok": false, "error": "UNAUTHENTICATED" }`.

## Response envelope

Successful responses use `{ "ok": true, ... }`. Errors follow `{ "ok": false, "error": "CODE" }` with an appropriate HTTP
 status code. Mutations return `201` when a new record is created.

## Core utility routes

| Method & Path | Description | Response |
| --- | --- | --- |
| `GET /v1/health` | Simple uptime probe. | `{ ok: true, ts: <epoch_ms> }` |
| `GET /v1/whoami` | Returns authenticated email if present. | `{ ok: true, email }` or `401` + `{ ok: false, error: "UNAUTHENTICATED" }` |
| `POST /v1/lead` | Captures marketing leads. Validates email format. | `{ ok: true }` or `400` + `{ ok: false, error: "EMAIL_REQUIRED" \| "INVALID_EMAIL" }` |
| `GET /v1/orders` | Returns the 50 most recent orders. | `{ ok: true, data: Order[] }` |

## Customers

Customers are stored in the `customers` table with string IDs and timestamps.

| Method & Path | Description | Request body | Success |
| --- | --- | --- | --- |
| `GET /v1/customers` | List customers ordered by `created_at` (newest first). | – | `{ ok: true, data: Customer[] }` |
| `POST /v1/customers` | Create a customer. | `{ name?: string, email: string, status?: string }` | `201` + `{ ok: true, data: Customer }` |
| `GET /v1/customers/{id}` | Fetch a customer. | – | `{ ok: true, data: Customer }` or `404` |
| `PUT/PATCH /v1/customers/{id}` | Update provided fields (`name`, `email`, `status`). | Partial object. | `{ ok: true, data: Customer }` |
| `DELETE /v1/customers/{id}` | Delete a customer. | – | `204` with CORS headers |

`Customer` payload:

```json
{
  "id": "uuid",
  "name": "string | null",
  "email": "string | null",
  "status": "string | null",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

## Subscriptions

Subscriptions describe purchasable plans. Features are stored as JSON.

| Method & Path | Description | Request body | Success |
| --- | --- | --- | --- |
| `GET /v1/subscriptions` | List subscriptions ordered by `created_at`. | – | `{ ok: true, data: Subscription[] }` |
| `POST /v1/subscriptions` | Create a subscription. | `{ name: string, description?: string, price?: number, billing_cycle?: string, status?: string, features?: any }` | `201` + `{ ok: true, data: Subscription }` |
| `GET /v1/subscriptions/{id}` | Fetch a subscription. | – | `{ ok: true, data: Subscription }` |
| `PUT/PATCH /v1/subscriptions/{id}` | Update mutable fields. | Partial subscription payload. | `{ ok: true, data: Subscription }` |
| `DELETE /v1/subscriptions/{id}` | Delete a subscription. | – | `204` |

`Subscription` payload:

```json
{
  "id": "uuid",
  "name": "string | null",
  "description": "string | null",
  "price": number | null,
  "billing_cycle": "string | null",
  "status": "string | null",
  "features": "string | null", // JSON-encoded
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

## Customer subscriptions

Associates customers with subscriptions and tracks optional lifecycle timestamps.

| Method & Path | Description | Request body |
| --- | --- | --- |
| `GET /v1/customer_subscriptions` | List relationships (filter with `customer_id` and/or `subscription_id`). | – |
| `POST /v1/customer_subscriptions` | Create a relationship. Validates both sides exist. | `{ customer_id, subscription_id, status?: string, started_at?: string, ended_at?: string }` |
| `GET /v1/customer_subscriptions/{id}` | Fetch a relationship. | – |
| `PUT/PATCH /v1/customer_subscriptions/{id}` | Update provided fields. | Partial relationship payload. |
| `DELETE /v1/customer_subscriptions/{id}` | Remove a relationship. | – |

Records include `id`, `customer_id`, `subscription_id`, `status`, `started_at`, `ended_at`, `created_at`, `updated_at`.

## Risk configuration & limits

Risk configuration records capture arbitrary limits and whether they are published.

| Method & Path | Description | Request body | Success |
| --- | --- | --- | --- |
| `GET /v1/risk/config` | List configurations (newest first). | – | `{ ok: true, data: RiskConfig[] }` |
| `POST /v1/risk/config` | Create configuration. | `{ name?: string, limits?: object, is_published?: boolean }` | `201` + `{ ok: true, data: RiskConfig }` |
| `GET /v1/risk/config/{id}` | Retrieve a configuration. | – | `{ ok: true, data: RiskConfig }` |
| `PUT/PATCH /v1/risk/config/{id}` | Update name, limits, or publication flag. | Partial config payload. | `{ ok: true, data: RiskConfig }` |
| `DELETE /v1/risk/config/{id}` | Delete a configuration. | – | `204` |
| `GET /v1/risk/limits` | Return the most recently published config. | – | `{ ok: true, data: RiskConfig }` or `404` + `{ ok: false, error: "NO_PUBLISHED_LIMITS" }` |
| `POST /v1/risk/check` | Validate an order against the published limits. Expects JSON body (e.g. `{ notional: number }`). | `{ ok: true, data: { limits } }` or `400` + `{ ok: false, error: "ORDER_EXCEEDS_LIMITS" }` |
| `POST /v1/risk/killswitch` | Clears publication status for all configs. | – | `{ ok: true, message: "Kill switch engaged" }` |

`RiskConfig` payloads decode the JSON `limits` column and coerce `is_published` to `true`/`false`:

```json
{
  "id": "uuid",
  "name": "string | null",
  "limits": { "any": "json" },
  "is_published": true,
  "published_at": "ISO timestamp | null",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

## Error codes

- `EMAIL_REQUIRED`, `INVALID_EMAIL`: lead capture validation.
- `NAME_REQUIRED`, `INVALID_PRICE`, `CUSTOMER_AND_SUBSCRIPTION_REQUIRED`, `INVALID_RELATION`, `NO_FIELDS`, `INVALID_BODY`: general validation failures.
- `CUSTOMER_CREATE_FAILED`: unique email constraint violation when creating a customer.
- `METHOD_NOT_ALLOWED`, `NOT_FOUND`, `NO_PUBLISHED_LIMITS`: standard HTTP semantics.
- `ORDER_EXCEEDS_LIMITS`: risk check failure when an order surpasses configured thresholds.

## Manual verification

Local QA uses `npm --workspace apps/api run test` which bundles the worker with esbuild, provisions the schema from
 `drizzle/0001_init.sql`, and exercises the REST endpoints via Miniflare.

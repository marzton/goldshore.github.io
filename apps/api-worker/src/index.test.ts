import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";

import worker, { type Env, resolveCorsOrigin, routeRequest } from "./index";
import * as webhookModule from "./webhook";

function createKVNamespace(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const namespace: KVNamespace = {
    async get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream") {
      const value = store.get(key);
      if (value === undefined) {
        return null;
      }
      if (type === "json") {
        return JSON.parse(value) as unknown;
      }
      return value as unknown;
    },
    async put(key: string, value: string | ArrayBuffer | ReadableStream, _options?: KVNamespacePutOptions) {
      if (typeof value === "string") {
        store.set(key, value);
      } else if (value instanceof ReadableStream) {
        store.set(key, "[stream]");
      } else {
        store.set(key, Buffer.from(value).toString("base64"));
      }
    },
    async delete(key: string) {
      store.delete(key);
    }
  };
  return namespace;
}

function createDurableObjectNamespace() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const namespace: DurableObjectNamespace = {
    idFromName: (name: string) => ({ toString: () => name }) as DurableObjectId,
    get: () => ({
      fetch: fetchMock
    })
  } as unknown as DurableObjectNamespace;
  return namespace;
}

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn()
  } as unknown as ExecutionContext;
}

function createJwt(secret: string, overrides: Record<string, unknown> = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "user", iss: "https://auth-dev.goldshore.org", aud: "goldshore-api-dev", iat: now, exp: now + 600, ...overrides };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function createEnv(overrides: Partial<Env> = {}): Env {
  const kvCache = createKVNamespace();
  const env: Env = {
    GITHUB_WEBHOOK_SECRET: "webhook-secret",
    GITHUB_APP_ID: "123",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VuBCIEILPgJtX9G0H4Hbvi+gJ6k06x9P+MwxlMh+BeSaOHzu+N\n-----END PRIVATE KEY-----",
    KV_SESSIONS: createKVNamespace(),
    KV_CACHE: kvCache,
    DO_SESSIONS: createDurableObjectNamespace(),
    Q_EVENTS: { send: vi.fn() } as unknown as Queue<unknown>,
    GOLDSHORE_ENV: "test",
    GOLDSHORE_ORIGIN: "https://api.goldshore.org",
    GOLDSHORE_CORS: "https://goldshore.org,https://app.goldshore.org",
    GOLDSHORE_JWT_SECRET: "jwt-secret",
    JWT_AUDIENCE: "goldshore-api-dev",
    JWT_ISSUER: "https://auth-dev.goldshore.org",
    RATE_LIMIT_MAX: "5",
    RATE_LIMIT_WINDOW: "60"
  };
  return { ...env, ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routeRequest", () => {
  it("forwards signed GitHub webhook requests to handleWebhook", async () => {
    const secret = "test-secret";
    const env = {
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_APP_ID: "123456",
      GITHUB_APP_PRIVATE_KEY: "dummy-key",
      GOLDSHORE_ENV: "test",
      GOLDSHORE_JWT_SECRET: "jwt-secret",
      KV_SESSIONS: {} as unknown as KVNamespace,
      KV_CACHE: {} as unknown as KVNamespace,
      DO_SESSIONS: {} as unknown as DurableObjectNamespace,
      Q_EVENTS: { send: vi.fn() } as unknown as Queue<unknown>,
      RATE_LIMIT_MAX: "10",
      RATE_LIMIT_WINDOW: "60"
    } as unknown as Env;

    const payload = JSON.stringify({ ref: "refs/heads/main" });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    const request = new Request("https://example.com/github/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": `sha256=${signature}`
      },
      body: payload
    });

    const ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;

    const handleWebhookSpy = vi.spyOn(webhookModule, "handleWebhook");

    const response = await worker.fetch(request, env, ctx);

    expect(handleWebhookSpy).toHaveBeenCalledTimes(1);
    expect(handleWebhookSpy).toHaveBeenCalledWith(request, env, ctx);
    expect(response.status).toBe(202);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("resolveCorsOrigin", () => {
  it("returns the exact origin when it matches the configured allow-list", () => {
    const env = createEnv({ GOLDSHORE_CORS: "https://goldshore.org,https://studio.goldshore.org" });
    const request = new Request("https://api.goldshore.org/v1/cache", { headers: { Origin: "https://studio.goldshore.org" } });
    expect(resolveCorsOrigin(request, env)).toBe("https://studio.goldshore.org");
  });

  it("falls back to the first configured origin when the requester is not allowed", () => {
    const env = createEnv({ GOLDSHORE_CORS: "https://goldshore.org,https://studio.goldshore.org" });
    const request = new Request("https://api.goldshore.org/v1/cache", { headers: { Origin: "https://unknown.example" } });
    expect(resolveCorsOrigin(request, env)).toBe("https://goldshore.org");
  });
});

describe("routeRequest security and integration", () => {
  it("exposes the health endpoint without authentication while preserving CORS", async () => {
    const env = createEnv();
    const ctx = createExecutionContext();
    const request = new Request("https://api.goldshore.org/health", {
      headers: { Origin: "https://goldshore.org" }
    });

    const response = await routeRequest(request, env, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://goldshore.org");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, env: "test" });
  });

  it("rejects protected endpoints that omit bearer tokens", async () => {
    const env = createEnv();
    const ctx = createExecutionContext();
    const request = new Request("https://api.goldshore.org/v1/cache?key=test", {
      headers: { Origin: "https://goldshore.org" }
    });

    const response = await routeRequest(request, env, ctx);
    expect(response.status).toBe(401);
  });

  it("serves cache responses with validated JWTs, KV reads, and rate limit headers", async () => {
    const env = createEnv();
    await env.KV_CACHE.put("data:foo", JSON.stringify({ value: 42 }));

    const ctx = createExecutionContext();
    const token = createJwt(env.GOLDSHORE_JWT_SECRET);
    const request = new Request("https://api.goldshore.org/v1/cache?key=data:foo", {
      method: "GET",
      headers: {
        Origin: "https://goldshore.org",
        Authorization: `Bearer ${token}`
      }
    });

    const response = await routeRequest(request, env, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://goldshore.org");
    expect(response.headers.get("X-RateLimit-Limit")).toBe(env.RATE_LIMIT_MAX);
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    const body = await response.json();
    expect(body).toMatchObject({ key: "data:foo", value: { value: 42 } });
  });
});

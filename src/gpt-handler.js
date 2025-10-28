const TOKEN_HEADER_NAME = "x-gpt-proxy-token";
const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GPT-Proxy-Token, Cf-Access-Jwt-Assertion",
};
const JWKS_CACHE_STORAGE_KEY = "__goldshore_access_jwks_cache";
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function parseAllowedOrigins(env) {
  const raw = env?.GPT_ALLOWED_ORIGINS;
  if (typeof raw !== "string") {
    return [];
  }

  return raw
    .split(/[,\n\r]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (typeof requestOrigin !== "string" || requestOrigin.trim() === "") {
    return null;
  }

  const allowedOrigins = parseAllowedOrigins(env);
  if (allowedOrigins.length === 0) {
    return null;
  }

  const normalizedOrigin = requestOrigin.trim();
  for (const allowed of allowedOrigins) {
    if (allowed === "*" || allowed === normalizedOrigin) {
      return normalizedOrigin;
    }
  }

  return null;
}

function applyCorsHeaders(headers, allowedOrigin) {
  for (const [key, value] of Object.entries(BASE_CORS_HEADERS)) {
    headers.set(key, value);
  }

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  } else {
    headers.delete("Access-Control-Allow-Origin");
  }

  headers.append("Vary", "Origin");

  return headers;
}

function jsonResponse(body, init = {}, allowedOrigin) {
  const headers = applyCorsHeaders(new Headers(init.headers || {}), allowedOrigin);
  headers.set("content-type", "application/json");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function getGlobalCache() {
  if (!globalThis[JWKS_CACHE_STORAGE_KEY]) {
    globalThis[JWKS_CACHE_STORAGE_KEY] = { value: null, expires: 0 };
  }

  return globalThis[JWKS_CACHE_STORAGE_KEY];
}

function normalizeBase64(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return normalized + "=".repeat(padding);
}

function base64UrlSegmentToUint8Array(segment) {
  const normalized = normalizeBase64(segment);
  const binary = atob(normalized);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

function base64UrlSegmentToJSON(segment) {
  try {
    const bytes = base64UrlSegmentToUint8Array(segment);
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error("Failed to decode JWT segment");
  }
}

async function loadJwks(env) {
  const jwksUrl = env?.CF_ACCESS_JWKS_URL;
  if (typeof jwksUrl !== "string" || jwksUrl.trim() === "") {
    throw new Error("Missing Cloudflare Access JWKS URL");
  }

  const cache = getGlobalCache();
  const now = Date.now();
  if (cache.value && cache.expires > now) {
    return cache.value;
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch Cloudflare Access JWKS (status ${response.status})`);
  }

  const data = await response.json();
  cache.value = data;
  cache.expires = now + JWKS_CACHE_TTL_MS;
  return data;
}

function extractAccessToken(request) {
  const headerToken = request.headers.get(ACCESS_JWT_HEADER);
  if (headerToken) {
    return headerToken;
  }

  const authHeader = request.headers.get("Authorization");
  if (typeof authHeader === "string") {
    const matches = authHeader.match(/^Bearer\s+(.+)$/i);
    if (matches && matches[1]) {
      return matches[1].trim();
    }
  }

  return null;
}

function getAudiences(payload) {
  const { aud } = payload || {};
  if (Array.isArray(aud)) {
    return aud;
  }

  if (typeof aud === "string") {
    return [aud];
  }

  return [];
}

async function enforceAccess(request, env, allowedOrigin) {
  if (request.method === "OPTIONS") {
    return null;
  }

  const requiredAud = env?.CF_ACCESS_AUD;
  if (typeof requiredAud !== "string" || requiredAud.trim() === "") {
    return jsonResponse({ error: "Cloudflare Access audience not configured." }, { status: 500 }, allowedOrigin);
  }

  const token = extractAccessToken(request);
  if (!token) {
    return jsonResponse({ error: "Missing Cloudflare Access token." }, { status: 401 }, allowedOrigin);
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return jsonResponse({ error: "Malformed Cloudflare Access token." }, { status: 401 }, allowedOrigin);
  }

  let header;
  let payload;
  try {
    header = base64UrlSegmentToJSON(parts[0]);
    payload = base64UrlSegmentToJSON(parts[1]);
  } catch (error) {
    return jsonResponse({ error: "Unable to parse Cloudflare Access token." }, { status: 401 }, allowedOrigin);
  }

  if (!header || typeof header !== "object") {
    return jsonResponse({ error: "Invalid Cloudflare Access token header." }, { status: 401 }, allowedOrigin);
  }

  const jwks = await loadJwks(env).catch(() => null);
  if (!jwks || !Array.isArray(jwks.keys)) {
    return jsonResponse({ error: "Unable to load Cloudflare Access signing keys." }, { status: 502 }, allowedOrigin);
  }

  const keyDefinition = jwks.keys.find((key) => key.kid === header.kid);
  if (!keyDefinition) {
    return jsonResponse({ error: "Unknown Cloudflare Access signing key." }, { status: 403 }, allowedOrigin);
  }

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      { ...keyDefinition, ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch (error) {
    return jsonResponse({ error: "Unable to prepare Cloudflare Access verification key." }, { status: 500 }, allowedOrigin);
  }

  const encoder = new TextEncoder();
  const signedData = encoder.encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlSegmentToUint8Array(parts[2]);

  const isValidSignature = await crypto.subtle
    .verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signedData)
    .catch(() => false);

  if (!isValidSignature) {
    return jsonResponse({ error: "Invalid Cloudflare Access token signature." }, { status: 403 }, allowedOrigin);
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && nowInSeconds >= payload.exp) {
    return jsonResponse({ error: "Expired Cloudflare Access token." }, { status: 401 }, allowedOrigin);
  }

  if (typeof payload.nbf === "number" && nowInSeconds < payload.nbf) {
    return jsonResponse({ error: "Cloudflare Access token not yet valid." }, { status: 401 }, allowedOrigin);
  }

  const audiences = getAudiences(payload);
  if (!audiences.includes(requiredAud)) {
    return jsonResponse({ error: "Cloudflare Access token audience mismatch." }, { status: 403 }, allowedOrigin);
  }

  return null;
}

const CODING_PURPOSE = "coding";
const DEFAULT_PURPOSE = "chat";
const MODEL_BY_PURPOSE = {
  [CODING_PURPOSE]: "gpt-5-codex",
  [DEFAULT_PURPOSE]: "gpt-5",
};

function resolvePurpose(value) {
  if (typeof value !== "string") {
    return DEFAULT_PURPOSE;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === CODING_PURPOSE ? CODING_PURPOSE : DEFAULT_PURPOSE;
}

async function handlePost(request, env, allowedOrigin) {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OpenAI API key." }, { status: 500 }, allowedOrigin);
  }

  const expectedToken = env.GPT_PROXY_TOKEN;
  if (!expectedToken) {
    return jsonResponse({ error: "Missing GPT proxy token." }, { status: 500 }, allowedOrigin);
  }

  const providedToken = request.headers.get(TOKEN_HEADER_NAME);
  if (!providedToken) {
    return jsonResponse({ error: "Missing authentication token." }, { status: 401 }, allowedOrigin);
  }

  if (providedToken !== expectedToken) {
    return jsonResponse({ error: "Invalid authentication token." }, { status: 403 }, allowedOrigin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body." }, { status: 400 }, allowedOrigin);
  }

  const {
    messages,
    prompt,
    model,
    purpose: rawPurpose = DEFAULT_PURPOSE,
    temperature,
    ...rest
  } = payload || {};

  if (!Array.isArray(messages) && typeof prompt !== "string") {
    return jsonResponse({
      error: "Request body must include either a 'messages' array or a 'prompt' string.",
    }, { status: 400 }, allowedOrigin);
  }

  const purpose = resolvePurpose(rawPurpose);

  const chatMessages = Array.isArray(messages)
    ? messages
    : [
        {
          role: "user",
          content: prompt,
        },
      ];

  const selectedModel = model || MODEL_BY_PURPOSE[purpose] || MODEL_BY_PURPOSE[DEFAULT_PURPOSE];

  const openAIOptions = { ...rest };

  if (typeof temperature === "number" && !Number.isNaN(temperature)) {
    openAIOptions.temperature = temperature;
  } else if (!("temperature" in openAIOptions)) {
    openAIOptions.temperature = purpose === CODING_PURPOSE ? 0.2 : 0.7;
  }

  const requestBody = {
    model: selectedModel,
    messages: chatMessages,
    ...openAIOptions,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      return jsonResponse({
        error: "Unexpected response from OpenAI API.",
        details: responseText,
      }, { status: 502 }, allowedOrigin);
    }

    if (!response.ok) {
      return jsonResponse({
        error: "OpenAI API request failed.",
        details: data,
      }, { status: response.status }, allowedOrigin);
    }

    return jsonResponse(data, { status: response.status }, allowedOrigin);
  } catch (error) {
    return jsonResponse({
      error: "Failed to contact OpenAI API.",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 502 }, allowedOrigin);
  }
}

export default {
  async fetch(request, env) {
    const allowedOrigin = resolveAllowedOrigin(request, env);
    const requestOrigin = request.headers.get("Origin");
    const hasAllowedOriginsConfigured = parseAllowedOrigins(env).length > 0;

    if (hasAllowedOriginsConfigured && requestOrigin && !allowedOrigin) {
      return jsonResponse({ error: "Origin not allowed." }, { status: 403 }, allowedOrigin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: applyCorsHeaders(new Headers(), allowedOrigin),
      });
    }

    const accessFailure = await enforceAccess(request, env, allowedOrigin);
    if (accessFailure) {
      return accessFailure;
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, { status: 405 }, allowedOrigin);
    }

    return handlePost(request, env, allowedOrigin);
  },
};

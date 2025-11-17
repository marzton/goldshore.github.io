const TOKEN_HEADER_NAME = "x-api-key";
const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-GPT-Proxy-Token, X-API-Key";
const CODING_PURPOSE = "coding";
const DEFAULT_PURPOSE = "chat";
const MODEL_BY_PURPOSE = {
  [CODING_PURPOSE]: "gpt-5-codex",
  [DEFAULT_PURPOSE]: "gpt-5",
};
const DEFAULT_MODEL = MODEL_BY_PURPOSE[DEFAULT_PURPOSE];
const BASE_SUPPORTED_MODELS = new Set(Object.values(MODEL_BY_PURPOSE));
const ALLOWED_CHAT_COMPLETION_OPTIONS = new Set([
  "frequency_penalty",
  "logit_bias",
  "logprobs",
  "max_tokens",
  "n",
  "presence_penalty",
  "response_format",
  "seed",
  "stop",
  "stream",
  "temperature",
  "top_p",
  "tools",
  "tool_choice",
  "user",
]);

const encoder = new TextEncoder();

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const encodedA = encoder.encode(a);
  const encodedB = encoder.encode(b);

  if (encodedA.length !== encodedB.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < encodedA.length; i += 1) {
    mismatch |= encodedA[i] ^ encodedB[i];
  }

  return mismatch === 0;
}

function resolvePurpose(value) {
  if (typeof value !== "string") {
    return DEFAULT_PURPOSE;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === CODING_PURPOSE ? CODING_PURPOSE : DEFAULT_PURPOSE;
}

function parseAllowedOrigins(env) {
  const raw = env.GPT_ALLOWED_ORIGINS ?? env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function getAllowedModels(env) {
  const raw = env.GPT_ALLOWED_MODELS;
  if (typeof raw !== "string" || raw.trim() === "") {
    return new Set(BASE_SUPPORTED_MODELS);
  }

  const entries = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (entries.includes("*")) {
    return null;
  }

  return new Set([...BASE_SUPPORTED_MODELS, ...entries]);
}

function resolveAllowedOrigin(requestOrigin, allowedOrigins) {
  if (!requestOrigin) {
    return null;
  }

  const normalized = requestOrigin.trim();
  if (normalized === "") {
    return null;
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(normalized).origin;
  } catch (error) {
    return null;
  }

  for (const allowed of allowedOrigins) {
    if (allowed === "*") {
      return parsedOrigin;
    }

    try {
      const allowedOrigin = new URL(allowed).origin;
      if (allowedOrigin === parsedOrigin) {
        return parsedOrigin;
      }
    } catch (error) {
      if (allowed === normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function buildCorsHeaders(origin) {
  const headers = new Headers();
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function mergeHeaders(target, source) {
  for (const [key, value] of source.entries()) {
    target.set(key, value);
  }
}

function jsonResponse(body, init = {}, corsOrigin = null) {
  const headers = new Headers(init.headers || {});
  const corsHeaders = buildCorsHeaders(corsOrigin);
  mergeHeaders(headers, corsHeaders);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

function errorResponse(message, status = 500, extras = undefined, corsOrigin = null, init = {}) {
  const payload = { error: message };
  if (extras && typeof extras === "object") {
    Object.assign(payload, extras);
  }

  return jsonResponse(payload, { status, ...init }, corsOrigin);
}

function validateOrigin(request, env) {
  const allowedOrigins = parseAllowedOrigins(env);
  const originHeader = request.headers.get("Origin");

  if (allowedOrigins.length === 0) {
    return { origin: originHeader?.trim() || null };
  }

  const resolvedOrigin = resolveAllowedOrigin(originHeader, allowedOrigins);

  if (originHeader && !resolvedOrigin) {
    return {
      errorResponse: errorResponse("Origin not allowed.", 403, undefined, originHeader.trim()),
    };
  }

  return { origin: resolvedOrigin };
}

function expectedProxySecret(env) {
  return env.GPT_PROXY_SECRET ?? env.GPT_SERVICE_TOKEN ?? env.GPT_PROXY_TOKEN ?? null;
}

function authorizeRequest(request, env, origin) {
  const expectedToken = expectedProxySecret(env);

  if (!expectedToken) {
    return errorResponse("Server misconfigured: missing GPT proxy secret.", 500, undefined, origin);
  }

  let providedToken = request.headers.get(TOKEN_HEADER_NAME);

  if (!providedToken) {
    const authorization = request.headers.get("Authorization") ?? "";
    if (authorization.toLowerCase().startsWith("bearer ")) {
      providedToken = authorization.slice("bearer ".length).trim();
    }
  }

  if (!providedToken) {
    return errorResponse("Missing authentication token.", 401, undefined, origin);
  }

  if (!timingSafeEqual(providedToken, expectedToken)) {
    return errorResponse("Invalid authentication token.", 403, undefined, origin);
  }

  return null;
}

function normalizeMessage(message, index) {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    throw new Error(`messages[${index}] must be an object.`);
  }

  const { role, content, name } = message;

  if (typeof role !== "string" || role.trim() === "") {
    throw new Error(`messages[${index}].role must be a non-empty string.`);
  }

  if (content === undefined) {
    throw new Error(`messages[${index}].content is required.`);
  }

  let normalizedContent;

  if (typeof content === "string") {
    if (content.trim() === "") {
      throw new Error(`messages[${index}].content must not be empty.`);
    }
    normalizedContent = content;
  } else if (Array.isArray(content)) {
    const parts = content
      .map((item, partIndex) => {
        if (item && typeof item === "object" && typeof item.text === "string") {
          return item.text;
        }
        throw new Error(
          `messages[${index}].content[${partIndex}] must be a text object when providing an array.`,
        );
      })
      .join("\n");

    if (parts.trim() === "") {
      throw new Error(`messages[${index}].content must include non-empty text.`);
    }

    normalizedContent = parts;
  } else if (content && typeof content === "object" && typeof content.text === "string") {
    if (content.text.trim() === "") {
      throw new Error(`messages[${index}].content.text must not be empty.`);
    }
    normalizedContent = content.text;
  } else {
    throw new Error(`messages[${index}].content must be a string or text object.`);
  }

  const normalized = {
    role: role.trim(),
    content: normalizedContent,
  };

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`messages[${index}].name must be a non-empty string when provided.`);
    }
    normalized.name = name.trim();
  }

  return normalized;
}

function buildChatCompletionPayload(payload, allowedModels) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { model, purpose, messages, prompt, stream, ...rest } = payload;

  const resolvedPurpose = resolvePurpose(purpose);
  const defaultModel = MODEL_BY_PURPOSE[resolvedPurpose] || DEFAULT_MODEL;
  const trimmedModel = typeof model === "string" && model.trim() !== "" ? model.trim() : defaultModel;

  if (allowedModels && allowedModels.size > 0 && !allowedModels.has(trimmedModel)) {
    throw new Error("Model is not supported.");
  }

  let normalizedMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    normalizedMessages = messages.map((message, index) => normalizeMessage(message, index));
  } else if (typeof prompt === "string" && prompt.trim() !== "") {
    normalizedMessages = [
      {
        role: "user",
        content: prompt.trim(),
      },
    ];
  } else {
    throw new Error("Request body must include either a 'messages' array or a non-empty 'prompt' string.");
  }

  if (typeof stream !== "undefined") {
    if (typeof stream === "string") {
      const normalized = stream.trim().toLowerCase();
      if (normalized && normalized !== "false" && normalized !== "0") {
        throw new Error("stream option is not supported by this proxy.");
      }
    } else if (stream) {
      throw new Error("stream option is not supported by this proxy.");
    }
  }

  const requestBody = {
    model: trimmedModel,
    messages: normalizedMessages,
  };

  for (const [key, value] of Object.entries(rest)) {
    if (!ALLOWED_CHAT_COMPLETION_OPTIONS.has(key) || value === undefined) {
      continue;
    }

    requestBody[key] = value;
  }

  return requestBody;
}

async function handlePost(request, env, corsOrigin) {
  if (!env.OPENAI_API_KEY) {
    return errorResponse("Missing OpenAI API key.", 500, undefined, corsOrigin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return errorResponse("Invalid JSON body.", 400, undefined, corsOrigin);
  }

  const allowedModels = getAllowedModels(env);
  let requestBody;
  try {
    requestBody = buildChatCompletionPayload(payload, allowedModels);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      400,
      undefined,
      corsOrigin,
    );
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      return errorResponse("Unexpected response from OpenAI API.", 502, text, corsOrigin);
    }

    if (!upstream.ok) {
      return errorResponse("OpenAI API request failed.", upstream.status, data, corsOrigin);
    }

    return jsonResponse(data, { status: upstream.status }, corsOrigin);
  } catch (error) {
    return errorResponse(
      "Failed to contact OpenAI API.",
      502,
      error instanceof Error ? error.message : String(error),
      corsOrigin,
    );
  }
}

export default {
  async fetch(request, env) {
    const { origin, errorResponse: originError } = validateOrigin(request, env);

    if (originError) {
      return originError;
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return errorResponse("Method not allowed.", 405, undefined, origin);
    }

    const authError = authorizeRequest(request, env, origin);
    if (authError) {
      return authError;
    }

    return handlePost(request, env, origin);
  },
};

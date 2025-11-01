const TOKEN_HEADER_NAME = "x-api-key";
const DEFAULT_MODEL = "gpt-4o-mini";
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

  let diff = 0;
  for (let index = 0; index < encodedA.length; index += 1) {
    diff |= encodedA[index] ^ encodedB[index];
  }

  return diff === 0;
}

function parseAllowedOrigins(env) {
  const raw = env.GPT_ALLOWED_ORIGINS ?? env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function resolveAllowedOrigin(requestOrigin, allowedOrigins) {
  if (typeof requestOrigin !== "string") {
    return null;
  }

  const normalized = requestOrigin.trim();
  if (normalized === "") {
    return null;
  }

  return allowedOrigins.includes(normalized) ? normalized : null;
}

function buildCorsHeaders(origin) {
  const headers = new Headers();

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, X-GPT-Proxy-Token, CF-Access-Jwt-Assertion",
  );

  return headers;
}

function jsonResponse(body, init = {}, origin = null) {
  const headers = new Headers(init.headers || {});
  const corsHeaders = buildCorsHeaders(origin);

  for (const [key, value] of corsHeaders.entries()) {
    headers.set(key, value);
  }

  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function errorResponse(message, status = 400, details, origin) {
  const payload = { error: message };
  if (details !== undefined) {
    payload.details = details;
  }
  return jsonResponse(payload, { status }, origin);
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
      errorResponse: errorResponse("Origin not allowed.", 403, undefined, originHeader),
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
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
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

function buildChatCompletionPayload(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { model = DEFAULT_MODEL, messages, prompt, ...rest } = payload;

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

  const modelName = typeof model === "string" && model.trim() !== "" ? model.trim() : DEFAULT_MODEL;

  const requestBody = {
    model: modelName,
    messages: normalizedMessages,
  };

  for (const [key, value] of Object.entries(rest)) {
    if (ALLOWED_CHAT_COMPLETION_OPTIONS.has(key)) {
      requestBody[key] = value;
    }
  }

  return requestBody;
}

async function handlePost(request, env, origin) {
  if (!env.OPENAI_API_KEY) {
    return errorResponse("Missing OpenAI API key.", 500, undefined, origin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return errorResponse("Invalid JSON body.", 400, undefined, origin);
  }

  let requestBody;
  try {
    requestBody = buildChatCompletionPayload(payload);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 400, undefined, origin);
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

    if (requestBody.stream) {
      if (!upstream.ok) {
        const errorText = await upstream.text();
        let details = errorText;
        try {
          details = JSON.parse(errorText);
        } catch (parseError) {
          // keep raw text when JSON parsing fails
        }
        return errorResponse("OpenAI API request failed.", upstream.status, details, origin);
      }

      const headers = buildCorsHeaders(origin);
      const contentType = upstream.headers.get("content-type");
      if (contentType) {
        headers.set("content-type", contentType);
      }
      headers.set("cache-control", "no-store");

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      return errorResponse("Unexpected response from OpenAI API.", 502, text, origin);
    }

    if (!upstream.ok) {
      return errorResponse("OpenAI API request failed.", upstream.status, data, origin);
    }

    return jsonResponse(data, { status: upstream.status }, origin);
  } catch (error) {
    return errorResponse(
      "Failed to contact OpenAI API.",
      502,
      error instanceof Error ? error.message : String(error),
      origin,
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

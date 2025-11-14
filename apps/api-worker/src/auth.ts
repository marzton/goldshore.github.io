import { Env } from ".";

const CF_ACCESS_CERTS_CACHE_KEY = "cf-access-certs-cache-key";
const CF_ACCESS_CERTS_CACHE_TTL_SECONDS = 300; // 5 minutes

export interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string;
  [key: string]: unknown;
}

interface Jwk {
  kid: string;
  alg: string;
  kty: string;
  e: string;
  n: string;
  use: string;
  x5c: string[];
  x5t: string;
}

interface Jwks {
  keys: Jwk[];
}

function base64UrlToUint8Array(segment: string): Uint8Array {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = normalized + (padding === 0 ? "" : "=".repeat(4 - padding));
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPayload(segment: string): JwtClaims {
  const json = new TextDecoder().decode(base64UrlToUint8Array(segment));
  return JSON.parse(json) as JwtClaims;
}

async function getJwks(env: Env): Promise<Jwks> {
  const cached = await env.KV_CACHE.get<Jwks>(CF_ACCESS_CERTS_CACHE_KEY, "json");
  if (cached) {
    return cached;
  }
  const response = await fetch(env.CLOUDFLARE_JWKS_URI);
  if (!response.ok) {
    throw new Error("Failed to fetch JWKS");
  }
  const jwks = await response.json<Jwks>();
  await env.KV_CACHE.put(CF_ACCESS_CERTS_CACHE_KEY, JSON.stringify(jwks), {
    expirationTtl: CF_ACCESS_CERTS_CACHE_TTL_SECONDS
  });
  return jwks;
}

export async function verifyJwt(token: string, env: Env): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(headerSegment)));
  if (!header.kid) {
    throw new Error("Missing kid in JWT header");
  }

  const jwks = await getJwks(env);
  const jwk = jwks.keys.find(key => key.kid === header.kid);
  if (!jwk) {
    throw new Error(`JWK not found for kid: ${header.kid}`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const encoder = new TextEncoder();
  const signedContent = encoder.encode(`${headerSegment}.${payloadSegment}`);
  const signature = base64UrlToUint8Array(signatureSegment);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signedContent
  );

  if (!valid) {
    throw new Error("Invalid signature");
  }

  const claims = decodeJwtPayload(payloadSegment);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (typeof claims.exp === "number" && claims.exp < nowSeconds) {
    throw new Error("Token expired");
  }

  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds) {
    throw new Error("Token not yet valid");
  }

  if (env.JWT_ISSUER && claims.iss !== env.JWT_ISSUER) {
    throw new Error("Unexpected issuer");
  }

  if (env.JWT_AUDIENCE) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud].filter(Boolean);
    if (audiences.length === 0 || !audiences.includes(env.JWT_AUDIENCE)) {
      throw new Error("Unexpected audience");
    }
  }

  return claims;
}

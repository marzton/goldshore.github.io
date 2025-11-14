import { describe, it, expect, vi } from 'vitest';
import { verifyJwt } from './auth';
import { Env } from './index';

// A mock JWKS endpoint response
const mockJwks = {
  keys: [
    {
      kid: 'mock-kid',
      alg: 'RS256',
      kty: 'RSA',
      e: 'AQAB',
      n: 'mock-n',
      use: 'sig',
    },
  ],
};

// A mock, structurally valid RS256 JWT
const mockJwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6Im1vY2sta2lkIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYXVkIjoiYzFmODJiNDEyODQ5ODhmYWRhZjZlYmZjM2JhODFlMTQ4OWU1NWI2MzNhY2RjZWQ1NjFlOGVjZjIwYWMzNjM4MSIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJodHRwczovL2F1dGguZ29sZHNob3JlLm9yZyJ9.c3RvY2suc2lnbmF0dXJl';

describe('auth', () => {
  it('should verify a valid JWT', async () => {
    const mockEnv = {
      KV_CACHE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      },
      CLOUDFLARE_JWKS_URI: 'https://mock-jwks-uri',
      JWT_AUDIENCE: 'c1f82b41284988fadaf6ebfc3ba81e1489e55b633acdced561e8ecf20ac36381',
      JWT_ISSUER: 'https://auth.goldshore.org',
    } as unknown as Env;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJwks),
    });

    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(true);

    await expect(verifyJwt(mockJwt, mockEnv)).resolves.not.toThrow();
  });
});

import type { ExportedHandler } from '@cloudflare/workers-types';

type Env = {
  APP_NAME: string;
  PRODUCTION_ASSETS?: string;
  PREVIEW_ASSETS?: string;
  DEV_ASSETS?: string;
};

const mapHostToAssets = (host: string, env: Env): string =>
  host.startsWith('preview.')
    ? env.PREVIEW_ASSETS ?? 'https://goldshore-org-preview.pages.dev'
    : host.startsWith('dev.')
      ? env.DEV_ASSETS ?? 'https://goldshore-org-dev.pages.dev'
      : env.PRODUCTION_ASSETS ?? 'https://goldshore-org.pages.dev';

const buildCorsHeaders = (origin: string): Headers => {
  const headers = new Headers();
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'GET,HEAD,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'accept,content-type');
  headers.set('access-control-max-age', '86400');
  headers.set('vary', 'origin');
  return headers;
};

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);

    const requestOrigin = req.headers.get('Origin') ?? `${url.protocol}//${url.host}`;

    if (req.method === 'OPTIONS') {
      const cors = buildCorsHeaders(requestOrigin);
      cors.set('content-length', '0');
      return new Response(null, { status: 204, headers: cors });
    }

    const assetsOrigin = mapHostToAssets(url.hostname, env);
    const proxyUrl = new URL(req.url.replace(url.origin, assetsOrigin));

    const headers = new Headers(req.headers);
    headers.delete('host');

    const body = req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await req.arrayBuffer();

    const proxiedResponse = await fetch(proxyUrl.toString(), {
      method: req.method,
      headers,
      body,
      redirect: 'follow'
    });

    const responseHeaders = new Headers(proxiedResponse.headers);
    responseHeaders.set('x-served-by', env.APP_NAME);
    const cors = buildCorsHeaders(requestOrigin);
    cors.forEach((value, key) => {
      if (key === 'vary' && responseHeaders.has('vary')) {
        const existing = responseHeaders.get('vary');
        if (existing && !existing
          .split(',')
          .map((token) => token.trim().toLowerCase())
          .includes(value.toLowerCase())) {
          responseHeaders.set('vary', `${existing}, ${value}`);
        }
        return;
      }

      responseHeaders.set(key, value);
    });

    return new Response(proxiedResponse.body, {
      status: proxiedResponse.status,
      headers: responseHeaders
    });
  }
} satisfies ExportedHandler<Env>;

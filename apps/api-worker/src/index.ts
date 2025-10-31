import { handleOptions, corsHeaders } from "./lib/cors";
import { handleWebhook, type WebhookEnv } from "./webhook";

export interface Env extends WebhookEnv {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);

    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "*";
    const headers = corsHeaders(origin);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          ...headers
        }
      });
    }

    const response = await handleWebhook(request, env, ctx);
    for (const [key, value] of Object.entries(headers)) {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    }
    return response;
  }
} satisfies ExportedHandler<Env>;

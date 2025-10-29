import { handleOptions, corsHeaders } from "./lib/cors";

interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          ...corsHeaders(request.headers.get("Origin") ?? "*")
        }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }
} satisfies ExportedHandler<Env>;

export function corsHeaders(origin: string = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

export function handleOptions(request: Request) {
  const headers = corsHeaders(request.headers.get("Origin") ?? "*");
  return new Response(null, { status: 204, headers });
}

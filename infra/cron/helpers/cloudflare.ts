const CF_API = "https://api.cloudflare.com/client/v4";
const tok = process.env.CF_API_TOKEN!;
const acc = process.env.CF_ACCOUNT_ID!;
const zone = process.env.CF_ZONE_ID!;

type RequestInitWithHeaders = RequestInit & { headers?: Record<string, string> };

async function cfFetch<T>(path: string, init?: RequestInitWithHeaders): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) throw new Error(`CF ${path} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result as T;
}

export async function getPagesProjectBuildStatus(project: string) {
  type Build = { latest_stage?: { status?: string } };
  const builds = await cfFetch<Build[]>(`/accounts/${acc}/pages/projects/${project}/deployments`);
  return builds[0]?.latest_stage?.status ?? "unknown";
}

export async function getDNSRecords() {
  type Rec = { id: string; name: string; type: string; content: string };
  return await cfFetch<Rec[]>(`/zones/${zone}/dns_records?per_page=200`);
}

export async function getWorkerBindings(script: string) {
  type Binding = { name: string; type: string };
  return await cfFetch<Binding[]>(`/accounts/${acc}/workers/scripts/${script}/bindings`);
}

type WorkerRoute = { pattern: string };

type WorkerSubdomain = { subdomain?: string | null };

function pickPrimaryRoute(routes: WorkerRoute[]): WorkerRoute {
  if (routes.length === 1) return routes[0];
  const scored = routes
    .map((route, index) => {
      const pattern = route.pattern.toLowerCase();
      const penalty = /preview|dev|staging|test/.test(pattern) ? 1 : 0;
      return { route, penalty, index };
    })
    .sort((a, b) => {
      if (a.penalty !== b.penalty) return a.penalty - b.penalty;
      return a.index - b.index;
    });
  return scored[0]!.route;
}

function buildRouteURL(pattern: string, routePath: string): string {
  let base = pattern;
  if (!base.includes("://")) base = `https://${base}`;
  const starIndex = base.indexOf("*");
  if (starIndex !== -1) {
    base = base.slice(0, starIndex);
  }
  if (!base.endsWith("/")) {
    base = `${base}/`;
  }
  const sanitizedPath = routePath.startsWith("/") ? routePath.slice(1) : routePath;
  return new URL(sanitizedPath, base).toString();
}

function buildWorkersSubdomainURL(subdomain: string, script: string, routePath: string): string {
  let base: string;
  if (subdomain.includes("://")) {
    base = subdomain;
  } else if (subdomain.includes(".")) {
    base = `https://${subdomain}`;
  } else {
    base = `https://${subdomain}.workers.dev`;
  }
  const trimmedScript = script.replace(/^\/+|\/+$/g, "");
  const sanitizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${trimmedScript}${sanitizedPath}`;
}

type FetchWorkerRouteOptions = {
  init?: RequestInitWithHeaders;
  domainOverride?: string;
};

export async function fetchWorkerRoute(
  script: string,
  routePath: string,
  options?: FetchWorkerRouteOptions
): Promise<{ url: string; response: Response }> {
  const { init, domainOverride } = options ?? {};
  const routes = await cfFetch<WorkerRoute[]>(`/accounts/${acc}/workers/scripts/${script}/routes`);
  let url: string;
  if (domainOverride) {
    url = buildRouteURL(domainOverride, routePath);
  } else if (routes.length) {
    const route = pickPrimaryRoute(routes);
    url = buildRouteURL(route.pattern, routePath);
  } else {
    const { subdomain } = await cfFetch<WorkerSubdomain>(`/accounts/${acc}/workers/subdomain`);
    if (!subdomain) {
      throw new Error(
        `No routes configured for Worker ${script} and account is missing a workers.dev subdomain`
      );
    }
    url = buildWorkersSubdomainURL(subdomain, script, routePath);
  }
  const { headers: initHeaders, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    "user-agent": "goldshore-agent/worker-health-check",
    ...(initHeaders ?? {})
  };
  const response = await fetch(url, { ...rest, headers });
  return { url, response };
}

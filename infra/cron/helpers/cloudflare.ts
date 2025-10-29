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

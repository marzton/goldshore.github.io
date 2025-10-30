const GH_API = "https://api.github.com";
const token = process.env.GH_TOKEN;

function baseHeaders(): Record<string, string> {
  if (!token) throw new Error("Missing GH_TOKEN environment variable");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "goldshore-agent"
  };
}

async function ghRequest(path: string, init: RequestInit = {}) {
  const headers = baseHeaders();
  if (init.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${GH_API}${path}`, { ...init, headers });
  return res;
}

async function ghJson<T>(path: string, init: RequestInit = {}) {
  const res = await ghRequest(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub request failed: ${res.status} ${res.statusText} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type PullRequest = {
  number: number;
  mergeable_state?: string;
};

export async function findOpenConflicts(owner: string, repo: string) {
  const prs = await ghJson<PullRequest[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
  const withConflicts: PullRequest[] = [];
  for (const pr of prs) {
    const details = await ghJson<PullRequest>(`/repos/${owner}/${repo}/pulls/${pr.number}`);
    if (details.mergeable_state === "dirty") withConflicts.push(details);
  }
  return withConflicts;
}

export async function openOpsIssue(owner: string, repo: string, title: string, body: string, labels: string[] = []) {
  return await ghJson(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels })
  });
}

export async function commentOnPR(owner: string, repo: string, prNumber: number, body: string) {
  await ghJson(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export async function createFixBranchAndPR(
  owner: string,
  repo: string,
  base: string,
  head: string,
  title: string,
  body: string,
  changes: Array<{ path: string; content: string }>
) {
  const baseRef = await gh.rest.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = baseRef.data.object.sha;
  const baseCommit = await gh.rest.git.getCommit({ owner, repo, commit_sha: baseSha });
  const baseTreeSha = baseCommit.data.tree.sha;

  let branchExists = false;
  let existingOpenPR: Awaited<ReturnType<typeof gh.rest.pulls.list>>["data"][number] | undefined;

  try {
    await gh.rest.git.getRef({ owner, repo, ref: `heads/${head}` });
    branchExists = true;
    const existing = await gh.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: `${owner}:${head}`,
      per_page: 1
    });
    existingOpenPR = existing.data[0];
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      branchExists = false;
    } else {
      throw error;
    }
  }

  if (!branchExists) {
    try {
      await gh.rest.git.createRef({ owner, repo, ref: `refs/heads/${head}`, sha: baseSha });
    } catch (error) {
      if (error instanceof RequestError && error.status === 422) {
        branchExists = true;
        const existing = await gh.rest.pulls.list({
          owner,
          repo,
          state: "open",
          head: `${owner}:${head}`,
          per_page: 1
        });
        existingOpenPR = existing.data[0];
      } else {
        throw error;
      }
    }
  }

  const blobs = await Promise.all(
    changes.map(c =>
      gh.rest.git.createBlob({
        owner,
        repo,
        content: c.content,
        encoding: "utf-8"
      })
    )
  );

  const tree = await gh.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: changes.map((c, i) => ({ path: c.path, mode: "100644", type: "blob", sha: blobs[i].data.sha }))
  });

  const commit = await gh.rest.git.createCommit({
    owner,
    repo,
    message: title,
    tree: tree.data.sha,
    parents: [baseSha]
  });

  await gh.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${head}`,
    sha: commit.data.sha,
    force: branchExists
  });

  if (existingOpenPR) return existingOpenPR;

  try {
    const pr = await gh.rest.pulls.create({ owner, repo, head, base, title, body });
    return pr.data;
  } catch (error) {
    if (error instanceof RequestError && error.status === 422) {
      const existing = await gh.rest.pulls.list({
        owner,
        repo,
        state: "open",
        head: `${owner}:${head}`,
        per_page: 1
      });
      if (existing.data.length > 0) return existing.data[0];
    }
    throw error;
  }
  const baseRef = await ghJson<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
  const baseSha = baseRef.object.sha;
  const baseCommit = await ghJson<{ tree: { sha: string } }>(`/repos/${owner}/${repo}/git/commits/${baseSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  const branchRef = `refs/heads/${head}`;
  const createRefRes = await ghRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: branchRef, sha: baseSha })
  });
  if (!createRefRes.ok && createRefRes.status !== 422) {
    const text = await createRefRes.text();
    throw new Error(`Failed to create ref ${branchRef}: ${createRefRes.status} ${text}`);
  }

  const blobs = await Promise.all(
    changes.map(async c =>
      ghJson<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: c.content, encoding: "utf-8" })
      })
    )
  );

  const tree = await ghJson<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: changes.map((c, i) => ({ path: c.path, mode: "100644", type: "blob", sha: blobs[i].sha }))
    })
  });

  const commit = await ghJson<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: title, tree: tree.sha, parents: [baseSha] })
  });

  await ghJson(`/repos/${owner}/${repo}/git/refs/heads/${head}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true })
  });

  const prRes = await ghRequest(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ head, base, title, body })
  });

  if (prRes.ok) {
    return (await prRes.json()) as PullRequest;
  }

  if (prRes.status === 422) {
    const params = new URLSearchParams({ state: "open", head: `${owner}:${head}` });
    const existing = await ghJson<PullRequest[]>(`/repos/${owner}/${repo}/pulls?${params.toString()}`);
    if (existing.length > 0) return existing[0];
  }

  const text = await prRes.text();
  throw new Error(`Failed to create pull request ${head}->${base}: ${prRes.status} ${text}`);
}

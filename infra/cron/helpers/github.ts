import { Octokit } from "octokit";

const token = process.env.GH_TOKEN;
let client: Octokit | null = null;

function getOctokit(): Octokit {
  if (!token) {
    throw new Error("Missing GH_TOKEN environment variable");
  }
  if (!client) {
    client = new Octokit({ auth: token });
  }
  return client;
}

type PullRequestSummary = {
  number: number;
  mergeable_state?: string;
  [key: string]: unknown;
};

export async function findOpenConflicts(owner: string, repo: string) {
  const octokit = getOctokit();
  const prs = await octokit.rest.pulls.list({ owner, repo, state: "open", per_page: 50 });
  const withConflicts: PullRequestSummary[] = [];
  for (const pr of prs.data) {
    const details = await octokit.rest.pulls.get({ owner, repo, pull_number: pr.number });
    if (details.data.mergeable_state === "dirty") {
      withConflicts.push(details.data as PullRequestSummary);
    }
  }
  return withConflicts;
}

export async function openOpsIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[] = []
) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.create({ owner, repo, title, body, labels });
  return data;
}

export async function commentOnPR(owner: string, repo: string, prNumber: number, body: string) {
  const octokit = getOctokit();
  await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
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
  const octokit = getOctokit();

  const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = baseRef.data.object.sha;
  const baseCommit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: baseSha });

  let parentSha = baseSha;
  let baseTreeSha = baseCommit.data.tree.sha;
  let branchExists = false;
  let existingPR: any | null = null;

  try {
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${head}`, sha: baseSha });
  } catch (error: unknown) {
    if (!(error && typeof error === "object" && "status" in error)) throw error;

    const status = (error as { status?: number }).status;
    if (status !== 422) throw error;

    branchExists = true;
    const headRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${head}` });
    parentSha = headRef.data.object.sha;

    const headCommit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: parentSha });
    baseTreeSha = headCommit.data.tree.sha;

    const existingPRs = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: `${owner}:${head}`,
      per_page: 1
    });
    if (existingPRs.data.length > 0) {
      existingPR = existingPRs.data[0];
    }
  }

  const blobs = await Promise.all(
    changes.map(c =>
      octokit.rest.git.createBlob({
        owner,
        repo,
        content: c.content,
        encoding: "utf-8"
      })
    )
  );

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: changes.map((c, i) => ({ path: c.path, mode: "100644", type: "blob", sha: blobs[i].data.sha }))
  });

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: title,
    tree: tree.data.sha,
    parents: [parentSha]
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${head}`,
    sha: commit.data.sha,
    force: branchExists
  });

  if (existingPR) {
    await octokit.rest.pulls.update({ owner, repo, pull_number: existingPR.number, title, body });
    const refreshed = await octokit.rest.pulls.get({ owner, repo, pull_number: existingPR.number });
    return refreshed.data;
  }

  try {
    const pr = await octokit.rest.pulls.create({ owner, repo, head, base, title, body });
    return pr.data;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 422) {
      const existing = await octokit.rest.pulls.list({
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
}

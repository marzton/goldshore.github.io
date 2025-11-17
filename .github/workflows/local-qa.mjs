import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const run = (command, options = {}) => {
  execSync(command, { stdio: "inherit", ...options });
};

console.log("Running Gold Shore local QA checks…");
run("npm run process-images");

const workspaceCandidates = ["apps/site", "apps/web"];
const workspaceName = workspaceCandidates.find((name) =>
  existsSync(join(process.cwd(), name)),
);

if (workspaceName) {
  const env = { ...process.env, CI: "" };
  run(`npm --workspace ${workspaceName} install`, { env });
  run(`npm --workspace ${workspaceName} run build`, { env });
} else {
  console.warn(
    `Skipping site checks because none of the workspaces [${workspaceCandidates.join(
      ", ",
    )}] were found.`,
  );
}

console.log("\n⚑ Manual step: run 'npm run qa:lighthouse' to execute Lighthouse locally.");

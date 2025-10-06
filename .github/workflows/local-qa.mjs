import { execSync } from "node:child_process";

const run = (command) => {
  execSync(command, { stdio: "inherit" });
};

console.log("Running Gold Shore local QA checks…");
run("node packages/image-tools/process-images.mjs");
run("cd apps/web && npm install");
run("cd apps/web && npm run build");
console.log("\nLighthouse: run 'npx http-server apps/web/dist -p 4173' then 'npx lighthouse http://localhost:4173' for manual scoring.");

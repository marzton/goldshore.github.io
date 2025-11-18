#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const userArgs = process.argv.slice(2);
const forwardedArgs = [];
const workspacePrefix = 'apps/api-worker/';

for (const arg of userArgs) {
  if (arg === '--runInBand') {
    // Vitest doesn't support Jest's --runInBand flag, so drop it gracefully.
    continue;
  }

  if (arg.startsWith(workspacePrefix)) {
    forwardedArgs.push(arg.slice(workspacePrefix.length));
    continue;
  }

  if (arg.startsWith(`./${workspacePrefix}`)) {
    forwardedArgs.push(arg.slice(workspacePrefix.length + 2));
    continue;
  }

  forwardedArgs.push(arg);
}

const npmArgs = ['run', '--workspace', 'apps/api-worker', 'test'];
if (forwardedArgs.length > 0) {
  npmArgs.push('--', ...forwardedArgs);
}

const result = spawnSync('npm', npmArgs, { stdio: 'inherit', env: process.env });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const bundlePath = path.join(repoRoot, 'infra', 'codex', 'env.secrets.bundle.json');
const guidePath = path.join(repoRoot, 'infra', 'codex', 'env.secrets.guide.json');

const PLACEHOLDER_PATTERN = /^\s*\$\{[^}]+\}\s*$/;

async function loadJson(file) {
  const contents = await readFile(file, 'utf8');
  return JSON.parse(contents);
}

function extractValue(entry) {
  if (entry === null || entry === undefined) return undefined;
  if (typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
    return entry.value;
  }
  return entry;
}

function isMissing(entry) {
  if (entry === undefined || entry === null) return true;
  const value = extractValue(entry);
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || PLACEHOLDER_PATTERN.test(trimmed);
  }
  return false;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function printInstructions(index, section, key, instructions) {
  console.log(`${index}. ${section}.${key}`);
  if (instructions.source) {
    console.log(`   Source: ${instructions.source}`);
  }
  if (instructions.path) {
    console.log(`   Path: ${instructions.path}`);
  }
  if (instructions.url) {
    console.log(`   URL: ${instructions.url}`);
  }
  if (instructions.notes) {
    console.log(`   Notes: ${instructions.notes}`);
  }

  const cli = [...asArray(instructions.cli_example), ...asArray(instructions.cli_examples)];
  if (cli.length) {
    console.log('   CLI:');
    cli.forEach((cmd) => console.log(`     - ${cmd}`));
  }

  const examples = asArray(instructions.examples);
  if (examples.length) {
    console.log('   Examples:');
    examples.forEach((example) => console.log(`     - ${example}`));
  }
}

async function main() {
  const [bundle, guide] = await Promise.all([loadJson(bundlePath), loadJson(guidePath)]);
  const missing = [];

  for (const [section, guideEntries] of Object.entries(guide)) {
    if (section === 'meta') continue;
    if (!guideEntries || typeof guideEntries !== 'object') continue;

    const bundleSection = bundle[section];

    for (const key of Object.keys(guideEntries)) {
      const guideEntry = guideEntries[key];
      const bundleEntry = bundleSection ? bundleSection[key] : undefined;
      if (isMissing(bundleEntry)) {
        missing.push({ section, key, instructions: guideEntry });
      }
    }
  }

  if (!missing.length) {
    console.log('All guide-tracked secrets are populated. ✅');
    return;
  }

  console.log(`Found ${missing.length} missing secrets:`);
  missing.forEach((entry, idx) => {
    printInstructions(idx + 1, entry.section, entry.key, entry.instructions || {});
  });
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Failed to inspect secrets bundle:', error);
  process.exitCode = 1;
});

#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const tag = `v${version}`;
const notesPath = join(rootDir, '.release-notes.md');

if (!version) {
  console.error('❌ package.json version is missing');
  process.exit(1);
}

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: rootDir,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  }).toString().trim();
}

try {
  run('git fetch --tags --force');
  const hasTag = run(`git tag -l ${tag}`, { capture: true }) === tag;

  if (hasTag) {
    console.log(`✅ Tag ${tag} already exists. Skipping tag/release creation.`);
    process.exit(0);
  }

  const notes = [
    `## cntx-ui ${version}`,
    '',
    'Automated release created from package version.',
    '',
    '### Validation',
    '- Version sync checks passed in CI',
    '- npm pack --dry-run completed'
  ].join('\n');
  writeFileSync(notesPath, notes, 'utf8');

  run(`git tag ${tag}`);
  run(`git push origin ${tag}`);
  run(`gh release create ${tag} --title "${tag}" --notes-file ${notesPath}`);

  console.log(`🚀 Created tag and release: ${tag}`);
} catch (error) {
  console.error('❌ Failed to create release:', error.message);
  process.exit(1);
} finally {
  if (existsSync(notesPath)) {
    try {
      unlinkSync(notesPath);
    } catch {
      // noop
    }
  }
}

#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const packageVersion = packageJson.version;

if (!packageVersion) {
  fail('package.json is missing version');
}

const mcpSource = readFileSync(join(rootDir, 'lib', 'mcp-server.js'), 'utf8');

if (!mcpSource.includes('getServerVersion()')) {
  fail('lib/mcp-server.js does not appear to use dynamic version resolution');
}

if (!mcpSource.includes("join(currentDir, '..', 'package.json')")) {
  fail('lib/mcp-server.js is not reading version from package.json');
}

const githubRefType = process.env.GITHUB_REF_TYPE;
const githubRefName = process.env.GITHUB_REF_NAME;

if (githubRefType === 'tag') {
  const expectedTag = `v${packageVersion}`;
  if (githubRefName !== expectedTag) {
    fail(`tag mismatch: expected ${expectedTag}, got ${githubRefName}`);
  }
  ok(`tag ${githubRefName} matches package version ${packageVersion}`);
}

ok(`version sync checks passed for package ${packageVersion}`);

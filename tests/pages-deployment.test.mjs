import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

test('GitHub Pages builds at the repository base without changing local root hosting', () => {
  assert.match(vite, /process\.env\.GITHUB_REPOSITORY/);
  assert.match(vite, /process\.env\.GITHUB_ACTIONS === 'true'/);
  assert.match(vite, /`\/\$\{repository\}\/`/);
  assert.match(vite, /: '\/';/);
});

test('GitHub Pages workflow builds dist with least-privilege deployment permissions', () => {
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /actions\/upload-pages-artifact@/);
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /actions\/deploy-pages@/);
});

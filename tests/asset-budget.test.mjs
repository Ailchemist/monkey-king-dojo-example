import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('deployable media stays within the hosting bandwidth budget', () => {
  const result = spawnSync(process.execPath, ['scripts/check-asset-budget.mjs'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Asset budget passed/);
});

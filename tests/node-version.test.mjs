import assert from 'node:assert/strict';
import { test } from 'node:test';
import { minimums, supportsNode } from '../scripts/check-node-version.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Node security floor permits later patch and minor releases, not another major', () => {
  for (const version of ['26.12.1', '26.12.2', '26.13.0', 'v26.12.1']) {
    assert.equal(supportsNode(version, '26.12.1'), true, version);
  }
  for (const version of ['26.12.0', '26.11.99', '24.22.1', '27.0.0',
    '26.12.1-rc.1', '26.x', 'not-a-version']) {
    assert.equal(supportsNode(version, '26.12.1'), false, version);
  }
  assert.equal(supportsNode('26.12.1', 'bad-minimum'), false);
});

test('Node 24 line (static hosting such as EdgeOne Pages) is accepted from 24.18.0', () => {
  for (const version of ['24.18.0', '24.18.1', '24.20.0']) {
    assert.equal(supportsNode(version, '24.18.0'), true, version);
  }
  for (const version of ['24.17.9', '24.11.1', '22.20.0', '25.0.0']) {
    assert.equal(supportsNode(version, '24.18.0'), false, version);
  }
  assert.deepEqual(minimums(), ['24.18.0', '26.12.1']);
});

test('the real CLI validates the runtime and reports its exact version', () => {
  const floor = minimums().find((minimum) => supportsNode(process.versions.node, minimum));
  const result = spawnSync(process.execPath,
    [fileURLToPath(new URL('../scripts/check-node-version.mjs', import.meta.url))],
    { encoding: 'utf8' });
  if (!floor) {
    // 跑测试的这个 Node 本身不在支持范围内：检查须拒绝它。
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is unsupported/);
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(process.version));
  assert.ok(result.stdout.includes(`minimum secure version ${floor}`));
});

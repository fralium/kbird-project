/* global process */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { recordApiMetric, getApiErrorMetrics } = require('../../server/middleware/apiMetrics');

const root = process.cwd();

test('phase4 observability files exist', () => {
  const requiredFiles = [
    'server/middleware/apiMetrics.js',
    'app/admin/observability/page.js',
    'pages/api/[...path].js',
    'docs/README.md',
  ];

  requiredFiles.forEach((relativePath) => {
    const filePath = path.join(root, relativePath);
    assert.equal(fs.existsSync(filePath), true, `Missing phase4 file: ${relativePath}`);
  });
});

test('api metrics aggregate 4xx and 5xx into grouped stats', () => {
  const reqBirds = { originalUrl: '/api/birds/68db6eba5fa3c9cec50de70a' };
  const reqLogin = { originalUrl: '/api/users/login' };
  const reqWebPage = { originalUrl: '/birds/68db6eba5fa3c9cec50de70a' };

  recordApiMetric(reqBirds, 200);
  recordApiMetric(reqBirds, 404);
  recordApiMetric(reqBirds, 500);
  recordApiMetric(reqLogin, 401);
  recordApiMetric(reqWebPage, 500); // should be ignored because not /api/*

  const metrics = getApiErrorMetrics(5);
  assert.ok(metrics.overall.total >= 4, 'overall total should include API calls');
  assert.ok(metrics.overall.errors4xx >= 2, '4xx count should be aggregated');
  assert.ok(metrics.overall.errors5xx >= 1, '5xx count should be aggregated');

  const birdsGroup = metrics.groups.find((item) => item.group === '/api/birds');
  assert.ok(birdsGroup, 'birds group should exist');
  assert.ok(birdsGroup.total >= 3, 'birds group should include requests');
});

test('rollback and stable scripts include dry-run support', () => {
  const checks = [
    { file: 'scripts/tag-stable.ps1', needle: '[switch]$DryRun' },
    { file: 'scripts/rollback-to-stable.ps1', needle: '[switch]$DryRun' },
    { file: 'scripts/tag-stable.sh', needle: '--dry-run' },
    { file: 'scripts/rollback-to-stable.sh', needle: '--dry-run' },
  ];

  checks.forEach(({ file, needle }) => {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(content.includes(needle), true, `${file} should support ${needle}`);
  });
});

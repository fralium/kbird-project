/* global process */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const requiredRouteFiles = [
  'pages/api/admin/error-metrics.js',
  'pages/api/users/login.js',
  'pages/api/records/index.js',
  'pages/api/locations/sync-from-records.js',
  'pages/api/ai/status.js',
  'pages/api/records/user/[userId].js',
];

test('critical API proxy route files exist', () => {
  requiredRouteFiles.forEach((relativePath) => {
    const filePath = path.join(root, relativePath);
    assert.equal(
      fs.existsSync(filePath),
      true,
      `Missing critical API route file: ${relativePath}`
    );
  });
});

/* global process */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const requiredRouteFiles = [
  'pages/api/[...path].js',
  'pages/api/uploads/[...path].js',
  'pages/api/images/birds/[...path].js',
  'pages/api/images/avatars/[...path].js',
  'pages/api/tianditu/geocode.js',
  'pages/api/observability/web-vitals.js',
];

test('critical API proxy and local route files exist', () => {
  requiredRouteFiles.forEach((relativePath) => {
    const filePath = path.join(root, relativePath);
    assert.equal(
      fs.existsSync(filePath),
      true,
      `Missing critical API route file: ${relativePath}`
    );
  });
});

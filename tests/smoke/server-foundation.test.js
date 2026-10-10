/* global process */
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateRequiredEnv } = require('../../server/config/validateEnv');
const {
  requestContextMiddleware,
  getRequestId,
} = require('../../server/middleware/requestContext');

test('validateRequiredEnv throws when required vars are missing', () => {
  const originalMongo = process.env.MONGODB_URI;
  const originalJwt = process.env.JWT_SECRET;
  delete process.env.MONGODB_URI;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(() => validateRequiredEnv(), /Missing required variables/);
  } finally {
    if (originalMongo !== undefined) process.env.MONGODB_URI = originalMongo;
    if (originalJwt !== undefined) process.env.JWT_SECRET = originalJwt;
  }
});

test('requestContextMiddleware sets and exposes request id', async () => {
  const req = {
    headers: {},
    method: 'GET',
    originalUrl: '/api/test',
  };
  let responseHeaderValue = null;
  const res = {
    setHeader(key, value) {
      if (String(key).toLowerCase() === 'x-request-id') {
        responseHeaderValue = value;
      }
    },
  };

  await new Promise((resolve, reject) => {
    requestContextMiddleware(req, res, () => {
      try {
        assert.ok(req.requestId);
        assert.equal(getRequestId(), req.requestId);
        assert.equal(responseHeaderValue, req.requestId);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});

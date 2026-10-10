const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const requestContext = new AsyncLocalStorage();

function createRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
}

const requestContextMiddleware = (req, res, next) => {
  const incomingRequestId =
    req.headers['x-request-id'] || req.headers['x-correlation-id'] || null;
  const requestId = incomingRequestId || createRequestId();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const context = {
    requestId,
    method: req.method,
    path: req.originalUrl,
  };

  requestContext.run(context, next);
};

const getRequestContext = () => requestContext.getStore() || null;

const getRequestId = () => getRequestContext()?.requestId || null;

module.exports = {
  requestContextMiddleware,
  getRequestContext,
  getRequestId,
};

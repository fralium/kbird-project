const isDevelopment = process.env.NODE_ENV === 'development';
const { getRequestId } = require('../middleware/requestContext');

const withRequestIdPrefix = (args) => {
  const requestId = getRequestId();
  if (!requestId) return args;
  return [`[rid:${requestId}]`, ...args];
};

const devLog = (...args) => {
  if (isDevelopment) {
    console.log(...withRequestIdPrefix(args));
  }
};

const devError = (...args) => {
  if (isDevelopment) {
    console.error(...withRequestIdPrefix(args));
  }
};

module.exports = {
  isDevelopment,
  devLog,
  devError,
};

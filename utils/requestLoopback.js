/**
 * Detect if an incoming Next.js / Express request is from the local machine.
 * Ignores X-Forwarded-For so a remote client cannot spoof loopback.
 */

export function normalizeIp(value) {
  return String(value || '')
    .replace(/^::ffff:/i, '')
    .trim()
    .toLowerCase();
}

export function isLoopbackIp(value) {
  const ip = normalizeIp(value);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/** Next.js pages/api request: use socket address only (not forwarded headers). */
export function isLocalLoopbackClient(req) {
  const candidates = [req?.socket?.remoteAddress, req?.connection?.remoteAddress]
    .filter(Boolean)
    .map(normalizeIp);
  return candidates.some(isLoopbackIp);
}

export function rejectUnlessLocalLoopback(res, message = '仅本机可访问此接口') {
  res.status(403).json({
    success: false,
    message,
    code: 'LOCAL_ONLY',
  });
  return true;
}

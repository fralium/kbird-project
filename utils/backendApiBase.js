/**
 * Next.js API 路由代理到 Express 时使用的根地址（含 /api 后缀）
 * 兼容：NEXT_PUBLIC_API_URL=http://localhost:13082 或 .../api
 */
export function resolveBackendApiBase() {
  const raw = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:13082'
  )
    .trim()
    .replace(/\/$/, '');
  if (!raw) return 'http://localhost:13082/api';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

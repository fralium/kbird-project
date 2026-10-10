/**
 * Browser-side backend base URL without trailing slash and without /api suffix.
 * Example:
 * - https://host -> https://host
 * - https://host/api -> https://host
 */
export function resolvePublicApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13082')
    .trim()
    .replace(/\/+$/, '');

  if (!raw) return 'http://localhost:13082';
  return raw.replace(/\/api$/i, '');
}

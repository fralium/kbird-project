/**
 * Central JWT secret: all environments must set JWT_SECRET.
 * Startup validation should fail fast if this value is missing.
 */

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s && String(s).trim()) {
    return String(s).trim();
  }
  throw new Error(
    'JWT_SECRET is required. Set it in .env (see env.example) before starting the server.'
  );
}

module.exports = { getJwtSecret };

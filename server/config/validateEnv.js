const REQUIRED_ENV_KEYS = ['MONGODB_URI', 'JWT_SECRET'];

function validateRequiredEnv() {
  const missing = REQUIRED_ENV_KEYS.filter(
    (key) => !process.env[key] || !String(process.env[key]).trim()
  );

  if (missing.length > 0) {
    const message = `[ENV] Missing required variables: ${missing.join(', ')}. Please update your .env file before starting the server.`;
    throw new Error(message);
  }

  const jwtSecret = String(process.env.JWT_SECRET || '');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && jwtSecret.length < 32) {
    throw new Error(
      '[ENV] JWT_SECRET must be at least 32 characters in production. Generate one with: node scripts/generate-jwt-secret.js'
    );
  }

  if (isProduction) {
    const setupToken = String(process.env.INIT_SETUP_TOKEN || '').trim();
    if (!setupToken) {
      throw new Error(
        '[ENV] INIT_SETUP_TOKEN is required in production to protect /api/init from unauthorized setup.'
      );
    }
  }
}

module.exports = {
  validateRequiredEnv,
};

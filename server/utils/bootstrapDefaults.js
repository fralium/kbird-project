const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
  defaultInitDbName,
  buildMongoUri,
  upsertEnvKeys,
  getEnvMap,
} = require('./envFile');
const { reconnectDB } = require('../config/db');
const { seedBirdsIfEmpty } = require('./seedBirds');
const { getDefaultUsername } = require('../config/appMode');

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123').trim() || 'admin123';

let bootstrapPromise = null;

function applyUpdatesToProcessEnv(updates) {
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  });
}

/**
 * Silent first-run setup: dated DB (when safe), default admin, bird seed.
 * Idempotent — safe to call on every server start / check-init.
 */
async function ensureDefaultSetup() {
  if (mongoose.connection.readyState !== 1) {
    return { ok: false, reason: 'db_not_ready' };
  }

  const User = require('../models/userModel');
  const Bird = require('../models/birdModel');

  const admin = await User.findOne({ role: 'admin' }).select('_id name').lean();
  if (admin) {
    const seed = await seedBirdsIfEmpty().catch((e) => ({ seeded: false, reason: e.message }));
    return { ok: true, alreadyInitialized: true, seed };
  }

  const userCount = await User.countDocuments();
  const birdCount = await Bird.countDocuments();
  const currentName = String(mongoose.connection.name || '');
  let dbSwitched = false;

  // Fresh empty install still on bare "kbird" → move to dated DB once
  if (userCount === 0 && birdCount === 0 && currentName === 'kbird') {
    const dated = defaultInitDbName();
    const uri = buildMongoUri({
      host: 'localhost',
      port: '27017',
      dbName: dated,
    });
    const written = upsertEnvKeys({ MONGODB_URI: uri });
    applyUpdatesToProcessEnv({ MONGODB_URI: uri });
    dbSwitched = await reconnectDB(uri);
    console.info(`[bootstrap] Using database ${dated} (${written.written?.join(',') || 'env'})`);
  }

  // Ensure JWT is not a weak placeholder on first use
  const map = getEnvMap();
  const jwt = String(map.JWT_SECRET || process.env.JWT_SECRET || '');
  if (!jwt || /^your-jwt-secret/i.test(jwt) || jwt.length < 16) {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    upsertEnvKeys({ JWT_SECRET: secret });
    process.env.JWT_SECRET = secret;
  }

  const adminName = getDefaultUsername();
  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  const raced = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (!raced) {
    await User.create({
      name: adminName,
      email: DEFAULT_ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
    });
    console.info(
      `[bootstrap] Default admin ready (user=${adminName}). Change password in Settings if needed.`
    );
  }

  const seed = await seedBirdsIfEmpty().catch((e) => ({ seeded: false, reason: e.message }));
  return {
    ok: true,
    alreadyInitialized: false,
    dbSwitched,
    adminCreated: true,
    defaultAdmin: { name: adminName, email: DEFAULT_ADMIN_EMAIL },
    seed,
  };
}

function ensureDefaultSetupOnce() {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureDefaultSetup().catch((err) => {
      bootstrapPromise = null;
      console.error('[bootstrap] failed:', err.message);
      throw err;
    });
  }
  return bootstrapPromise;
}

module.exports = {
  ensureDefaultSetup,
  ensureDefaultSetupOnce,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
};

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
  defaultInitDbName,
  buildMongoUri,
  upsertEnvKeys,
  getEnvMap,
  parseMongoUri,
} = require('./envFile');
const { reconnectDB } = require('../config/db');
const { seedBirdsIfEmpty } = require('./seedBirds');
const { getDefaultUsername } = require('../config/appMode');

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123').trim() || 'admin123';

/** Per-project marker: this clone has finished first-run DB binding */
const INSTANCE_READY_KEY = 'KBIRD_INSTANCE_READY';

let bootstrapPromise = null;

function applyUpdatesToProcessEnv(updates) {
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  });
}

function isInstanceReady(envMap) {
  const v = String(envMap[INSTANCE_READY_KEY] || process.env[INSTANCE_READY_KEY] || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function ensureStrongJwt() {
  const map = getEnvMap();
  const jwt = String(map.JWT_SECRET || process.env.JWT_SECRET || '');
  if (!jwt || /^your-jwt-secret/i.test(jwt) || jwt.length < 16) {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    upsertEnvKeys({ JWT_SECRET: secret });
    process.env.JWT_SECRET = secret;
  }
}

async function ensureAdminAndSeed() {
  const User = require('../models/userModel');
  const admin = await User.findOne({ role: 'admin' }).select('_id name').lean();
  let adminCreated = false;

  if (!admin) {
    const adminName = getDefaultUsername();
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    const raced = await User.findOne({ role: 'admin' }).select('_id').lean();
    if (!raced) {
      await User.create({
        name: adminName,
        email: DEFAULT_ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        mustChangePassword: true,
      });
      adminCreated = true;
      console.info(
        `[bootstrap] Default admin ready (user=${adminName}). mustChangePassword=true — change password in Settings.`
      );
    }
  }

  const seed = await seedBirdsIfEmpty().catch((e) => ({ seeded: false, reason: e.message }));
  return { adminCreated, seed, alreadyHadAdmin: Boolean(admin) };
}

/**
 * Silent first-run setup for THIS project folder.
 *
 * Important: multiple clones share one MongoDB server. Template .env uses /kbird,
 * which may already have data from the main install. So first-run of a new clone
 * must bind to its own dated DB even if shared `kbird` already has admins.
 *
 * Marker KBIRD_INSTANCE_READY=1 in this project's .env means "already bound".
 */
async function ensureDefaultSetup() {
  if (mongoose.connection.readyState !== 1) {
    return { ok: false, reason: 'db_not_ready' };
  }

  const envMap = getEnvMap();
  let dbSwitched = false;

  if (!isInstanceReady(envMap)) {
    const parsed = parseMongoUri(process.env.MONGODB_URI || envMap.MONGODB_URI || '');
    // Template default DB name only — leave custom names alone
    if (String(parsed.dbName || '') === 'kbird') {
      const dated = defaultInitDbName();
      const uri = buildMongoUri({
        host: parsed.host || 'localhost',
        port: parsed.port || '27017',
        dbName: dated,
      });
      upsertEnvKeys({ MONGODB_URI: uri });
      applyUpdatesToProcessEnv({ MONGODB_URI: uri });
      dbSwitched = await reconnectDB(uri);
      console.info(
        `[bootstrap] New project instance → database ${dated} (isolated from shared kbird)`
      );
    }

    ensureStrongJwt();
    const { adminCreated, seed, alreadyHadAdmin } = await ensureAdminAndSeed();
    upsertEnvKeys({ [INSTANCE_READY_KEY]: '1' });
    process.env[INSTANCE_READY_KEY] = '1';

    return {
      ok: true,
      alreadyInitialized: alreadyHadAdmin && !adminCreated,
      dbSwitched,
      adminCreated,
      seed,
      instanceReady: true,
    };
  }

  // Subsequent starts: keep current .env DB (e.g. main install stays on kbird)
  ensureStrongJwt();
  const { adminCreated, seed, alreadyHadAdmin } = await ensureAdminAndSeed();
  return {
    ok: true,
    alreadyInitialized: alreadyHadAdmin && !adminCreated,
    dbSwitched: false,
    adminCreated,
    seed,
    instanceReady: true,
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
  INSTANCE_READY_KEY,
};

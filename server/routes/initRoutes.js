const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { sendControllerError } = require('../middleware/controllerError');
const { isLocalLoopbackRequest } = require('../config/appMode');
const {
  buildUpdatesFromGuiPayload,
  upsertEnvKeys,
  parseMongoUri,
} = require('../utils/envFile');
const { reconnectDB } = require('../config/db');
const { seedBirdsIfEmpty } = require('../utils/seedBirds');

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (h === '127.0.0.1' || h === '::1') return 'localhost';
  return h || 'localhost';
}

function applyUpdatesToProcessEnv(updates) {
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  });
}

/** Client may need restart for NEXT_PUBLIC_* / PORT; DB+admin can finish in one pass. */
function needsSoftRestart(envWritten = []) {
  return envWritten.some(
    (k) =>
      k.startsWith('NEXT_PUBLIC_') ||
      k === 'PORT' ||
      k === 'TIANDITU_SERVER_TK' ||
      k === 'OPENAI_API_KEY' ||
      k === 'OPENAI_BASE_URL' ||
      k === 'OPENAI_MODEL' ||
      k === 'HHO_API_KEY' ||
      k === 'HHO_API_URL'
  );
}

// @desc    检查系统初始化状态
// @route   GET /api/check-init
// @access  Public
router.get('/check-init', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;

    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: '数据库连接失败',
        initialized: false,
      });
    }

    // 懒加载兜底：启动竞态时仍可在首次探测时完成默认就绪
    try {
      const { ensureDefaultSetupOnce } = require('../utils/bootstrapDefaults');
      await ensureDefaultSetupOnce();
    } catch {
      // ignore; fall through to admin check
    }

    const User = require('../models/userModel');
    const { getAppModePublic } = require('../config/appMode');
    const existingAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
    const initialized = Boolean(existingAdmin);
    const fromEnv = parseMongoUri(process.env.MONGODB_URI || '');

    const { isLocalLoopbackRequest } = require('../config/appMode');
    // 非本机只返回是否已初始化，避免暴露 autoLogin / 库主机信息
    if (!isLocalLoopbackRequest(req)) {
      return res.json({ success: true, initialized });
    }

    res.json({
      success: true,
      initialized,
      ...getAppModePublic(),
      mongo: {
        dbName: mongoose.connection?.name || fromEnv.dbName || 'kbird',
        dbHost: normalizeHost(mongoose.connection?.host || fromEnv.host || 'localhost'),
        dbPort: String(mongoose.connection?.port || fromEnv.port || '27017'),
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '系统初始化检查失败',
      defaultCode: 'INIT_CHECK_FAILED',
      status: 500,
      fallbackPayload: {
        initialized: false,
      },
    });
  }
});

// @desc    系统初始化：写 .env → 热切换 Mongo → 建管理员 → 空库导入鸟种种子（一次完成）
// @route   POST /api/init
// @access  Public（生产/已配令牌时需 x-setup-token；写 .env 仅本机）
router.post('/init', async (req, res) => {
  try {
    const setupToken = String(process.env.INIT_SETUP_TOKEN || '').trim();
    const providedToken = req.headers['x-setup-token'];
    // 始终要求令牌（开发也需配置 INIT_SETUP_TOKEN），避免未设 NODE_ENV 时误开初始化
    if (!setupToken || !timingSafeEqualString(providedToken, setupToken)) {
      return res.status(403).json({
        success: false,
        message: setupToken ? '初始化令牌无效' : '缺少 INIT_SETUP_TOKEN，请先在 .env 中配置',
      });
    }

    const User = require('../models/userModel');
    const existingAdmin = await User.findOne({ role: 'admin' });
    const confirmOverwrite = Boolean(req.body?.confirmOverwrite);

    if (existingAdmin && !confirmOverwrite) {
      return res.status(409).json({
        success: false,
        message: '系统已有配置。继续将覆盖本机 .env 与管理员账号，请勾选确认后再提交。',
        initialized: true,
        needsOverwriteConfirm: true,
      });
    }

    if (!isLocalLoopbackRequest(req)) {
      return res.status(403).json({
        success: false,
        message: '写入本机 .env 仅允许从本机（127.0.0.1）访问',
      });
    }

    let envWritten = [];
    let dbSwitched = false;
    let seedResult = null;

    try {
      const { updates } = buildUpdatesFromGuiPayload(req.body || {}, { forInit: true });
      if (Object.keys(updates).length > 0) {
        const result = upsertEnvKeys(updates);
        envWritten = result.written || [];
        applyUpdatesToProcessEnv(updates);

        if (updates.MONGODB_URI) {
          dbSwitched = await reconnectDB(updates.MONGODB_URI);
        }
      }
    } catch (envError) {
      return res.status(400).json({
        success: false,
        message: envError.message || '写入 .env / 连接数据库失败',
      });
    }

    const { adminUsername, adminEmail, adminPassword } = req.body || {};

    if (!(adminUsername && adminEmail && adminPassword)) {
      return res.status(400).json({
        success: false,
        message: '请填写管理员用户名、邮箱和密码',
        initialized: false,
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // 覆盖模式：重置管理员；首次：创建
    if (confirmOverwrite && existingAdmin) {
      await User.deleteMany({ role: 'admin' });
    }

    const racedAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
    if (!racedAdmin) {
      try {
        await User.create({
          name: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
        });
      } catch (createError) {
        const again = await User.findOne({ role: 'admin' }).select('_id').lean();
        if (!again) throw createError;
      }
    }

    try {
      seedResult = await seedBirdsIfEmpty();
    } catch (seedError) {
      console.warn('[init] bird seed skipped:', seedError.message);
      seedResult = { seeded: false, reason: 'error', message: seedError.message };
    }

    const softRestart = needsSoftRestart(envWritten);
    const birdNote =
      seedResult?.seeded
        ? `已导入鸟种名录 ${seedResult.imported} 条。`
        : seedResult?.reason === 'already_has_birds'
          ? '鸟种名录已存在，已跳过导入。'
          : seedResult?.reason === 'no_seed_file'
            ? '未找到种子文件，可稍后运行 init-database.ps1。'
            : '';

    return res.json({
      success: true,
      message: softRestart
        ? `初始化完成，可以开始使用。${birdNote}若填写了地图/AI Key，建议稍后重启 KBird-Start.bat 后再用相关功能。`
        : `初始化完成，可以开始使用。${birdNote}`,
      initialized: true,
      adminCreated: true,
      dbSwitched,
      // 不再因换库要求「重启后再 init」；仅提示可选软重启（地图/AI）
      restartRequired: softRestart,
      restartOptional: softRestart,
      dbChanged: false,
      envWritten,
      seed: seedResult,
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '系统初始化失败',
      defaultCode: 'INIT_FAILED',
      status: 500,
      fallbackPayload: {
        initialized: false,
      },
    });
  }
});

module.exports = router;

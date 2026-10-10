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

function isMongoTargetChanged(requestedUri) {
  if (!requestedUri) return false;
  const requested = parseMongoUri(requestedUri);
  const currentName = mongoose.connection?.name || '';
  const currentHost = mongoose.connection?.host || 'localhost';
  const currentPort = String(mongoose.connection?.port || '27017');
  return (
    String(requested.dbName) !== String(currentName) ||
    normalizeHost(requested.host) !== normalizeHost(currentHost) ||
    String(requested.port) !== String(currentPort)
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

    const User = require('../models/userModel');
    const { getAppModePublic } = require('../config/appMode');
    const existingAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
    const initialized = Boolean(existingAdmin);

    res.json({
      success: true,
      initialized,
      ...getAppModePublic(),
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

// @desc    系统初始化（可选写入本机 .env）
// @route   POST /api/init
// @access  Public（生产/已配令牌时需 x-setup-token；写 .env 仅本机）
router.post('/init', async (req, res) => {
  try {
    const setupToken = String(process.env.INIT_SETUP_TOKEN || '').trim();
    const providedToken = req.headers['x-setup-token'];
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction || setupToken) {
      if (!setupToken || !timingSafeEqualString(providedToken, setupToken)) {
        return res.status(403).json({
          success: false,
          message: setupToken ? '初始化令牌无效' : '生产环境缺少 INIT_SETUP_TOKEN',
        });
      }
    }

    const User = require('../models/userModel');
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      return res.json({
        success: true,
        message: '系统已初始化',
        initialized: true,
      });
    }

    let envWritten = [];
    let restartRequired = false;
    let dbChanged = false;

    try {
      const { updates } = buildUpdatesFromGuiPayload(req.body || {}, { forInit: true });
      if (Object.keys(updates).length > 0) {
        if (!isLocalLoopbackRequest(req)) {
          return res.status(403).json({
            success: false,
            message: '写入本机 .env 仅允许从本机（127.0.0.1）访问',
          });
        }
        dbChanged = isMongoTargetChanged(updates.MONGODB_URI);
        const result = upsertEnvKeys(updates);
        envWritten = result.written || [];
        restartRequired = envWritten.length > 0;
      }
    } catch (envError) {
      return res.status(400).json({
        success: false,
        message: envError.message || '写入 .env 失败',
      });
    }

    if (dbChanged) {
      return res.json({
        success: true,
        message:
          '数据库连接已写入本机 .env，与当前运行中的连接不同。请关闭并重新运行 KBird-Desktop.bat 后，再打开 /init 完成管理员创建。',
        initialized: false,
        restartRequired: true,
        dbChanged: true,
        envWritten,
        adminCreated: false,
      });
    }

    const { adminUsername, adminEmail, adminPassword } = req.body || {};

    if (adminUsername && adminEmail && adminPassword) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      const racedAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
      if (racedAdmin) {
        return res.json({
          success: true,
          message: '系统已初始化',
          initialized: true,
          restartRequired,
          envWritten,
        });
      }

      try {
        await User.create({
          name: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
        });
      } catch (createError) {
        const again = await User.findOne({ role: 'admin' }).select('_id').lean();
        if (again) {
          return res.json({
            success: true,
            message: '系统已初始化',
            initialized: true,
            restartRequired,
            envWritten,
          });
        }
        throw createError;
      }

      return res.json({
        success: true,
        message: restartRequired
          ? '系统初始化完成。部分配置已写入 .env，请重启 KBird-Desktop.bat 后地图/AI 等才会生效。'
          : '系统初始化完成',
        initialized: true,
        adminCreated: true,
        restartRequired,
        dbChanged: false,
        envWritten,
      });
    }

    return res.json({
      success: true,
      message: restartRequired
        ? '配置已写入 .env。请重启后再打开 /init 创建管理员。'
        : '系统初始化完成',
      initialized: false,
      adminCreated: false,
      restartRequired,
      dbChanged: false,
      envWritten,
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

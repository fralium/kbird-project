const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendControllerError } = require('../middleware/controllerError');

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// @desc    检查系统初始化状态
// @route   GET /api/check-init
// @access  Public
router.get('/check-init', async (req, res) => {
  try {
    // 检查数据库连接
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: '数据库连接失败',
        initialized: false
      });
    }
    
    // 以“是否存在管理员账号”作为系统是否完成初始化的统一标准
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

// @desc    系统初始化
// @route   POST /api/init
// @access  Public
router.post('/init', async (req, res) => {
  try {
    const setupToken = String(process.env.INIT_SETUP_TOKEN || '').trim();
    const providedToken = req.headers['x-setup-token'];
    const isProduction = process.env.NODE_ENV === 'production';
    // 生产环境必须校验；开发环境若配置了令牌也强制校验
    if (isProduction || setupToken) {
      if (!setupToken || !timingSafeEqualString(providedToken, setupToken)) {
        return res.status(403).json({
          success: false,
          message: setupToken ? '初始化令牌无效' : '生产环境缺少 INIT_SETUP_TOKEN',
        });
      }
    }

    const { adminUsername, adminEmail, adminPassword } = req.body;
    
    // 检查是否已有管理员用户
    const User = require('../models/userModel');
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      return res.json({
        success: true,
        message: '系统已初始化',
        initialized: true
      });
    }
    
    // 创建管理员用户（保存前再查一次，降低并发双管理员竞态）
    if (adminUsername && adminEmail && adminPassword) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      const racedAdmin = await User.findOne({ role: 'admin' }).select('_id').lean();
      if (racedAdmin) {
        return res.json({
          success: true,
          message: '系统已初始化',
          initialized: true,
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
          });
        }
        throw createError;
      }

      return res.json({
        success: true,
        message: '系统初始化完成',
        initialized: true,
        adminCreated: true,
      });
    }

    return res.json({
      success: true,
      message: '系统初始化完成',
      initialized: true,
      adminCreated: false,
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

const express = require('express');
const router = express.Router();

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
    
    // 检查是否有用户数据
    const User = require('../models/userModel');
    const userCount = await User.countDocuments();
    
    res.json({
      success: true,
      message: '系统已初始化',
      initialized: true,
      userCount: userCount,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '系统初始化检查失败',
      error: error.message,
      initialized: false
    });
  }
});

// @desc    系统初始化
// @route   POST /api/init
// @access  Public
router.post('/init', async (req, res) => {
  try {
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
    
    // 创建管理员用户
    if (adminUsername && adminEmail && adminPassword) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminUser = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isVerified: true
      });
      
      await adminUser.save();
      
      res.json({
        success: true,
        message: '系统初始化完成',
        initialized: true,
        adminCreated: true
      });
    } else {
      res.json({
        success: true,
        message: '系统初始化完成',
        initialized: true,
        adminCreated: false
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '系统初始化失败',
      error: error.message,
      initialized: false
    });
  }
});

module.exports = router;

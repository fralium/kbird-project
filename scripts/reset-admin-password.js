/**
 * 重置管理员密码（测试/本地用）
 * 用法：在项目根目录执行
 *   node scripts/reset-admin-password.js "新密码"
 * 或先设置环境变量 ADMIN_NEW_PASSWORD：
 *   set ADMIN_NEW_PASSWORD=新密码  (Windows)
 *   export ADMIN_NEW_PASSWORD=新密码  (Linux/macOS)
 *   node scripts/reset-admin-password.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../server/models/userModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

async function main() {
  const newPassword = process.argv[2] || process.env.ADMIN_NEW_PASSWORD;
  if (!newPassword || newPassword.length < 6) {
    console.error('请提供至少 6 位的新密码。');
    console.error('用法: node scripts/reset-admin-password.js "新密码"');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('已连接 MongoDB');

    const admin = await User.findOne({ role: 'admin' }).select('+password');
    if (!admin) {
      console.error('未找到 role=admin 的用户。请先创建管理员或检查数据库。');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save({ validateBeforeSave: false });

    console.log('管理员密码已重置。');
    console.log('  用户:', admin.email || admin.name);
    console.log('  请使用新密码登录。');
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('已断开数据库连接');
  }
}

main();

/**
 * 重置指定用户的密码（忘记密码时使用）
 * 用法：在项目根目录执行
 *   node scripts/reset-user-password.js "用户名或邮箱" "新密码"
 * 示例：
 *   node scripts/reset-user-password.js "Kevin" "MyNewPassword123"
 *   node scripts/reset-user-password.js "kevin@example.com" "MyNewPassword123"
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../server/models/userModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

async function main() {
  const login = process.argv[2]; // 用户名或邮箱
  const newPassword = process.argv[3];

  if (!login || !newPassword || newPassword.length < 6) {
    console.error('用法: node scripts/reset-user-password.js "用户名或邮箱" "新密码"');
    console.error('示例: node scripts/reset-user-password.js "Kevin" "MyNewPassword123"');
    console.error('      新密码至少 6 位。');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('已连接 MongoDB');

    const isEmail = /@/.test(login);
    const query = isEmail ? { email: login } : { name: login };
    const user = await User.findOne(query).select('+password');
    if (!user) {
      console.error('未找到用户:', login);
      console.error('请确认用户名或邮箱正确（区分大小写）。');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save({ validateBeforeSave: false });

    console.log('密码已重置成功。');
    console.log('  用户:', user.name, user.email ? `(${user.email})` : '');
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

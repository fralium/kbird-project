const mongoose = require('mongoose');
require('dotenv').config();
const { devLog } = require('../utils/devLogger');

const connectDB = async () => {
  try {
    // 使用MongoDB Atlas云数据库或本地数据库
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
    devLog('MongoDB URI source:', process.env.MONGODB_URI ? 'env' : 'default-local');

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.info(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接错误: ${error.message}`);
    console.error('请确保MongoDB已安装并运行，或者使用MongoDB Atlas云数据库');
    if (process.env.NODE_ENV === 'production') {
      console.error('生产环境无法连接数据库，进程退出');
      process.exit(1);
    }
  }
};

/**
 * Switch mongoose to a new URI (used by /api/init so one wizard pass can finish).
 * Returns true if a reconnect was performed.
 */
async function reconnectDB(mongoURI) {
  const uri = String(mongoURI || '').trim();
  if (!uri) throw new Error('缺少 MONGODB_URI');

  const { parseMongoUri } = require('../utils/envFile');
  const normalizeHost = (host) => {
    const h = String(host || '')
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '');
    if (h === '127.0.0.1' || h === '::1') return 'localhost';
    return h || 'localhost';
  };
  if (mongoose.connection?.readyState === 1) {
    const want = parseMongoUri(uri);
    const haveName = mongoose.connection.name || '';
    const haveHost = normalizeHost(mongoose.connection.host || 'localhost');
    const havePort = String(mongoose.connection.port || '27017');
    if (
      String(want.dbName) === String(haveName) &&
      normalizeHost(want.host) === haveHost &&
      String(want.port) === havePort
    ) {
      process.env.MONGODB_URI = uri;
      return false;
    }
    await mongoose.disconnect();
  }

  process.env.MONGODB_URI = uri;
  const conn = await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.info(`MongoDB 已切换连接: ${conn.connection.host}/${conn.connection.name}`);
  return true;
}

module.exports = connectDB;
module.exports.default = connectDB;
module.exports.reconnectDB = reconnectDB;
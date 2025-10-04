const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // 使用MongoDB Atlas云数据库或本地数据库
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
    console.log('MongoDB URI:', mongoURI);
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接错误: ${error.message}`);
    console.log('请确保MongoDB已安装并运行，或者使用MongoDB Atlas云数据库');
    // 不退出进程，让服务器继续运行以便调试
    // process.exit(1);
  }
};

module.exports = connectDB;
module.exports.default = connectDB;
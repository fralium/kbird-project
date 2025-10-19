const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '请输入姓名'],
    },
    email: {
      type: String,
      required: [true, '请输入邮箱'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        '请输入有效的邮箱地址',
      ],
    },
    password: {
      type: String,
      required: [true, '请输入密码'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'contributor', 'admin'],
      default: 'user',
    },
    avatar: {
      type: String,
      default: 'default-avatar.jpg',
    },
    bio: {
      type: String,
    },
    location: {
      type: String,
    },
    website: {
      type: String,
    },
    contributions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bird',
      },
    ],
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bird',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// 避免重复编译模型
const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;
module.exports.default = User;
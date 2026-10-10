#!/usr/bin/env node
/**
 * 生成随机 JWT_SECRET，写入终端后复制到 .env
 * 用法: node scripts/generate-jwt-secret.js
 */
const crypto = require('crypto');
console.log(crypto.randomBytes(48).toString('hex'));

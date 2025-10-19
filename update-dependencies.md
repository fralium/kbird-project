# KBird 依赖更新说明

## 📋 更新内容

### ✅ 已更新的依赖包

1. **移除重复字体包**
   - ❌ 移除: `fontsource-noto-sans-sc@4.0.0` (已弃用)
   - ✅ 保留: `@fontsource/noto-sans-sc@5.2.8` (最新版本)

2. **更新Multer (安全修复)**
   - ❌ 旧版本: `multer@1.4.5-lts.1` (存在安全漏洞)
   - ✅ 新版本: `multer@2.0.0-rc.4` (修复安全漏洞)

3. **更新ESLint (兼容性修复)**
   - ❌ 旧版本: `eslint@8.47.0` (不再支持)
   - ✅ 新版本: `eslint@9.0.0` (最新支持版本)
   - ❌ 旧版本: `eslint-config-next@13.4.19`
   - ✅ 新版本: `eslint-config-next@15.0.0`

4. **添加新依赖**
   - ✅ 添加: `rimraf@5.0.0` (替换过时的rimraf@3.0.2)
   - ✅ 添加: `glob@10.0.0` (替换过时的glob@7.1.7)

## 🔧 需要处理的代码变更

### 1. Multer API 变更

**旧版本 (1.x):**
```javascript
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
```

**新版本 (2.x):**
```javascript
const multer = require('multer');
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  }
});
```

### 2. ESLint 配置更新

**需要创建新的ESLint配置文件:**
```javascript
// eslint.config.js (新格式)
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  js.configs.recommended,
  ...nextPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // 自定义规则
    }
  }
];
```

## 🚀 更新步骤

### 1. 安装新依赖
```bash
npm install
```

### 2. 更新代码中的Multer使用
检查以下文件中的multer使用：
- `server/middleware/fileUploadSecurity.js`
- `server/routes/uploadRoutes.js`
- `pages/api/upload/image.js`

### 3. 更新ESLint配置
- 创建新的 `eslint.config.js`
- 移除旧的 `.eslintrc.json` (如果存在)

### 4. 测试功能
- 测试文件上传功能
- 测试代码检查功能
- 运行构建测试

## ⚠️ 注意事项

1. **Multer 2.x 破坏性变更**
   - 某些API可能不兼容
   - 需要测试文件上传功能

2. **ESLint 9.x 配置变更**
   - 使用新的扁平配置格式
   - 可能需要调整规则配置

3. **版本兼容性**
   - 确保所有依赖版本兼容
   - 测试生产环境构建

## 📊 更新统计

- **移除依赖**: 1个 (fontsource-noto-sans-sc)
- **更新依赖**: 3个 (multer, eslint, eslint-config-next)
- **新增依赖**: 2个 (rimraf, glob)
- **版本提升**: 1.0.0 → 1.1.0

## 🔍 测试清单

- [ ] 文件上传功能正常
- [ ] 代码检查无错误
- [ ] 构建过程成功
- [ ] 生产环境部署正常
- [ ] 所有页面功能正常

# KBird 发布版本同步指南

## 🎯 问题解决方案

由于开发过程中修改的文件分散在各个文件夹，手动跟踪所有修改很困难。本指南提供了多种自动化解决方案来同步最新代码到发布版本。

## 🛠️ 解决方案

### 方案一：Git智能同步脚本（推荐）

**文件**: `sync-with-git.ps1`

**特点**:
- ✅ 基于Git状态检测修改的文件
- ✅ 自动排除临时文件和调试文件
- ✅ 智能文件哈希比较，只同步真正修改的文件
- ✅ 自动Git提交和标签创建
- ✅ 支持预览模式（DryRun）

**使用方法**:
```powershell
# 预览模式（不实际复制文件）
.\sync-with-git.ps1 -DryRun

# 同步到v1.1.0版本
.\sync-with-git.ps1 -Version "v1.1.0"

# 强制同步所有重要文件
.\sync-with-git.ps1 -Version "v1.1.0" -Force

# 自定义源路径
.\sync-with-git.ps1 -SourcePath "..\KBird" -Version "v1.1.0"
```

### 方案二：简单批处理脚本

**文件**: `update-release.bat`

**特点**:
- ✅ 简单易用，双击即可运行
- ✅ 使用robocopy高效复制
- ✅ 自动Git操作

**使用方法**:
```batch
# 直接双击运行
update-release.bat

# 或命令行运行
.\update-release.bat
```

## 📋 推荐工作流程

### 1. 日常开发
```bash
# 在原始KBird文件夹中开发
cd D:\CADD\AIDD\KBird

# 进行功能开发
# ... 你的开发工作 ...

# 提交到Git（可选）
git add .
git commit -m "Add new feature: description"
```

### 2. 同步到发布版本
```bash
# 切换到发布版本目录
cd D:\CADD\AIDD\KBird\KBird-release

# 使用Git智能同步脚本
.\sync-with-git.ps1 -Version "v1.1.0" -DryRun  # 先预览
.\sync-with-git.ps1 -Version "v1.1.0"          # 执行同步

# 或使用批处理脚本
.\update-release.bat
```

### 3. 推送到远程仓库
```bash
# 在KBird-release目录中
git push origin master
git push origin v1.1.0
```

## 🔧 脚本配置

### 排除文件列表
所有脚本都会自动排除以下类型的文件：
- 临时文件: `*.log`, `*.tmp`, `*.temp`
- 调试文件: `*debug*.js`, `*test*.js`, `*temp*.js`
- 开发工具文件: `*fix*.js`, `*parse*.js`, `*check*.js`
- 数据文件: `bird.csv`, `baohu.png`, `config.json`
- 系统目录: `node_modules`, `.next`, `.git`, `logs`, `uploads`, `backups`

### 重要文件列表
以下文件即使没有修改也会被同步：
- 配置文件: `package.json`, `next.config.js`, `docker-compose.yml`
- 文档文件: `README.md`, `LICENSE`, `.gitignore`
- 脚本文件: `restart.sh`, `ecosystem.config.js`

## 🚀 高级用法

### 自定义排除规则
修改脚本中的 `$ExcludePatterns` 数组来添加自定义排除规则：

```powershell
$ExcludePatterns = @(
    "node_modules\*",
    "*.log",
    "custom_exclude_pattern\*"  # 添加自定义规则
)
```

### 批量版本更新
创建批处理脚本来处理多个版本：

```batch
@echo off
echo 更新多个版本...

call update-release.bat v1.1.0
call update-release.bat v1.1.1
call update-release.bat v1.2.0

echo 所有版本更新完成！
```

### 自动化部署
结合CI/CD工具使用：

```yaml
# GitHub Actions 示例
- name: Sync Release Version
  run: |
    cd KBird-release
    .\sync-with-git.ps1 -Version "v${{ github.ref_name }}"
    git push origin master
    git push origin "v${{ github.ref_name }}"
```

## 🔍 故障排除

### 常见问题

1. **权限错误**
   ```powershell
   # 以管理员身份运行PowerShell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Git状态检查失败**
   ```bash
   # 确保源目录是Git仓库
   cd ..
   git status
   ```

3. **文件被锁定**
   ```powershell
   # 关闭可能占用文件的程序
   # 重新运行脚本
   ```

### 调试模式
```powershell
# 启用详细输出
$VerbosePreference = "Continue"
.\sync-with-git.ps1 -Version "v1.1.0" -DryRun
```

## 📊 性能优化

### 大项目优化
对于大型项目，可以：
1. 使用 `robocopy` 替代 `Copy-Item`
2. 并行处理文件复制
3. 增量同步而非全量复制

### 网络同步
如果需要通过网络同步：
```powershell
# 使用rsync（需要安装）
rsync -av --exclude-from=exclude.txt ../ ./ --delete
```

## 🎯 最佳实践

1. **定期同步**: 建议每次完成一个功能后立即同步
2. **版本管理**: 使用语义化版本号（如 v1.1.0）
3. **测试验证**: 同步后测试发布版本是否正常工作
4. **文档更新**: 同步时更新CHANGELOG.md
5. **备份策略**: 重要更新前备份当前发布版本

## 📞 技术支持

如果遇到问题：
1. 检查脚本日志输出
2. 确认文件路径正确
3. 验证Git仓库状态
4. 检查文件权限设置

---

**注意**: 建议在生产环境使用前先在测试环境验证脚本的正确性。

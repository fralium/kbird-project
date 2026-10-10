/**
 * 检查所有页面文件中的导入问题
 * 检查 Link, useRouter, Head 等 Next.js 组件的导入情况
 */

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const componentsDir = path.join(__dirname, '..', 'components');

// 需要检查的组件和对应的导入语句
const requiredImports = {
  'Link': {
    pattern: /<Link\s|Link\./,
    import: "import Link from 'next/link';",
    description: 'Next.js Link component'
  },
  'useRouter': {
    pattern: /useRouter\(/,
    import: "import { useRouter } from 'next/router';",
    description: 'Next.js useRouter hook'
  },
  'Head': {
    pattern: /<Head\s|Head\./,
    import: "import Head from 'next/head';",
    description: 'Next.js Head component'
  },
  'Image': {
    pattern: /<Image\s|from ['"]next\/image['"]/,
    import: "import Image from 'next/image';",
    description: 'Next.js Image component',
    // 排除普通 img 标签
    exclude: /<img\s/
  },
  'Script': {
    pattern: /<Script\s|Script\./,
    import: "import Script from 'next/script';",
    description: 'Next.js Script component'
  }
};

// 递归获取所有 JS/JSX 文件
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 .next
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 检查单个文件
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const issues = [];
  
  // 检查每个必需的导入
  Object.entries(requiredImports).forEach(([name, config]) => {
    // 检查是否使用了该组件
    if (config.pattern.test(content)) {
      // 检查是否已导入
      const importPattern = new RegExp(`import.*${name}.*from|import.*${name}.*from`, 'i');
      if (!importPattern.test(content)) {
        issues.push({
          component: name,
          import: config.import,
          description: config.description,
          line: content.split('\n').findIndex(line => config.pattern.test(line)) + 1
        });
      }
    }
  });
  
  return {
    file: relativePath,
    issues
  };
}

// 主函数
function main() {
  console.log('🔍 开始检查导入问题...\n');
  
  const pageFiles = getAllFiles(pagesDir);
  const componentFiles = getAllFiles(componentsDir);
  const allFiles = [...pageFiles, ...componentFiles];
  
  const results = [];
  let totalIssues = 0;
  
  allFiles.forEach(file => {
    const result = checkFile(file);
    if (result.issues.length > 0) {
      results.push(result);
      totalIssues += result.issues.length;
    }
  });
  
  // 输出结果
  if (results.length === 0) {
    console.log('✅ 所有文件的导入都正确！\n');
    return;
  }
  
  console.log(`❌ 发现 ${totalIssues} 个导入问题，涉及 ${results.length} 个文件：\n`);
  
  results.forEach(result => {
    console.log(`📄 ${result.file}`);
    result.issues.forEach(issue => {
      console.log(`   ❌ 缺少导入: ${issue.component} (${issue.description})`);
      console.log(`      建议添加: ${issue.import}`);
      if (issue.line) {
        console.log(`      使用位置: 第 ${issue.line} 行`);
      }
      console.log('');
    });
  });
  
  console.log('\n📝 修复建议：');
  console.log('1. 在文件顶部添加缺失的导入语句');
  console.log('2. 确保导入语句放在其他导入之后');
  console.log('3. 运行此脚本验证修复结果\n');
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, getAllFiles };

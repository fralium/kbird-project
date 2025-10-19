import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Init.module.css';

export default function Init() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  // 添加调试信息
  useEffect(() => {
    console.log('Current step changed to:', step);
  }, [step]);
  const [config, setConfig] = useState({
    // 基本信息
    siteName: 'KBird',
    siteDescription: '鸟类收集整理网站',
    siteUrl: 'http://localhost:3000',
    
    // 数据库配置
    dbName: 'kbird',
    dbHost: 'localhost',
    dbPort: '27017',
    
    // 服务器配置
    backendPort: '3002',
    frontendPort: '3000',
    
    // UI主题
    theme: 'default',
    primaryColor: '#4CAF50',
    secondaryColor: '#2196F3',
    
    // 功能设置
    enableRegistration: true,
    enableComments: true,
    enableUpload: true,
    maxFileSize: '5MB',
    
    // 管理员账户
    adminUsername: 'admin',
    adminEmail: 'admin@example.com',
    adminPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    console.log('handleNext called, current step:', step);
    if (step < 5) {
      setStep(step + 1);
      console.log('Moving to step:', step + 1);
    } else {
      console.log('Already at final step');
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // 验证管理员密码
      if (config.adminPassword !== config.confirmPassword) {
        setError('管理员密码不匹配');
        setLoading(false);
        return;
      }

      if (config.adminPassword.length < 6) {
        setError('管理员密码至少6位');
        setLoading(false);
        return;
      }

      // 发送配置到后端
      const response = await fetch('/api/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (result.success) {
        // 初始化成功，清除本地状态并跳转到登录页面
        console.log('初始化成功，准备跳转到登录页面');
        // 清除可能的缓存状态
        localStorage.removeItem('init-checked');
        // 延迟一下确保配置写入完成
        setTimeout(() => {
          router.replace('/login');
        }, 500);
      } else {
        setError(result.message || '初始化失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className={styles.step}>
      <h2>基本信息设置</h2>
      <div className={styles.formGroup}>
        <label>网站名称</label>
        <input
          type="text"
          value={config.siteName}
          onChange={(e) => handleInputChange('siteName', e.target.value)}
          placeholder="请输入网站名称"
        />
      </div>
      <div className={styles.formGroup}>
        <label>网站描述</label>
        <textarea
          value={config.siteDescription}
          onChange={(e) => handleInputChange('siteDescription', e.target.value)}
          placeholder="请输入网站描述"
          rows={3}
        />
      </div>
      <div className={styles.formGroup}>
        <label>网站URL</label>
        <input
          type="url"
          value={config.siteUrl}
          onChange={(e) => handleInputChange('siteUrl', e.target.value)}
          placeholder="http://localhost:3000"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.step}>
      <h2>数据库配置</h2>
      <div className={styles.formGroup}>
        <label>数据库名称</label>
        <input
          type="text"
          value={config.dbName}
          onChange={(e) => handleInputChange('dbName', e.target.value)}
          placeholder="kbird"
        />
      </div>
      <div className={styles.formGroup}>
        <label>数据库主机</label>
        <input
          type="text"
          value={config.dbHost}
          onChange={(e) => handleInputChange('dbHost', e.target.value)}
          placeholder="localhost"
        />
      </div>
      <div className={styles.formGroup}>
        <label>数据库端口</label>
        <input
          type="text"
          value={config.dbPort}
          onChange={(e) => handleInputChange('dbPort', e.target.value)}
          placeholder="27017"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className={styles.step}>
      <h2>服务器配置</h2>
      <div className={styles.formGroup}>
        <label>后端端口</label>
        <input
          type="number"
          value={config.backendPort}
          onChange={(e) => handleInputChange('backendPort', e.target.value)}
          placeholder="3002"
        />
      </div>
      <div className={styles.formGroup}>
        <label>前端端口</label>
        <input
          type="number"
          value={config.frontendPort}
          onChange={(e) => handleInputChange('frontendPort', e.target.value)}
          placeholder="3000"
        />
      </div>
      <div className={styles.formGroup}>
        <label>主题风格</label>
        <select
          value={config.theme}
          onChange={(e) => handleInputChange('theme', e.target.value)}
        >
          <option value="default">默认主题</option>
          <option value="dark">深色主题</option>
          <option value="nature">自然主题</option>
          <option value="ocean">海洋主题</option>
        </select>
      </div>
      <div className={styles.colorGroup}>
        <div className={styles.formGroup}>
          <label>主色调</label>
          <input
            type="color"
            value={config.primaryColor}
            onChange={(e) => handleInputChange('primaryColor', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>辅助色</label>
          <input
            type="color"
            value={config.secondaryColor}
            onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className={styles.step}>
      <h2>功能设置</h2>
      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.enableRegistration}
            onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
          />
          允许用户注册
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.enableComments}
            onChange={(e) => handleInputChange('enableComments', e.target.checked)}
          />
          允许评论
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.enableUpload}
            onChange={(e) => handleInputChange('enableUpload', e.target.checked)}
          />
          允许文件上传
        </label>
      </div>
      <div className={styles.formGroup}>
        <label>最大文件大小</label>
        <select
          value={config.maxFileSize}
          onChange={(e) => handleInputChange('maxFileSize', e.target.value)}
        >
          <option value="1MB">1MB</option>
          <option value="5MB">5MB</option>
          <option value="10MB">10MB</option>
          <option value="20MB">20MB</option>
        </select>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className={styles.step}>
      <h2>管理员账户</h2>
      <div className={styles.formGroup}>
        <label>管理员用户名</label>
        <input
          type="text"
          value={config.adminUsername}
          onChange={(e) => handleInputChange('adminUsername', e.target.value)}
          placeholder="admin"
        />
      </div>
      <div className={styles.formGroup}>
        <label>管理员邮箱</label>
        <input
          type="email"
          value={config.adminEmail}
          onChange={(e) => handleInputChange('adminEmail', e.target.value)}
          placeholder="admin@example.com"
        />
      </div>
      <div className={styles.formGroup}>
        <label>管理员密码</label>
        <input
          type="password"
          value={config.adminPassword}
          onChange={(e) => handleInputChange('adminPassword', e.target.value)}
          placeholder="至少6位密码"
        />
      </div>
      <div className={styles.formGroup}>
        <label>确认密码</label>
        <input
          type="password"
          value={config.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          placeholder="再次输入密码"
        />
      </div>
    </div>
  );

  // 防止服务端渲染问题
  if (!mounted) {
    return null;
  }

  return (
    <>
      <Head>
        <title>KBird 初始化设置</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🐦 KBird 初始化设置</h1>
          <p>欢迎使用 KBird！请完成以下配置以开始使用。</p>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
          <span>步骤 {step} / 5</span>
        </div>

        <div className={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.actions} onClick={(e) => {
          console.log('Actions div clicked');
          e.stopPropagation();
        }}>
          {step > 1 && (
            <button 
              className={styles.btnSecondary} 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Prev button clicked');
                handlePrev();
              }}
              disabled={loading}
            >
              上一步
            </button>
          )}
          
          {step < 5 ? (
            <button 
              className={styles.btnPrimary} 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Next button clicked');
                handleNext();
              }}
              disabled={loading}
              style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              下一步
            </button>
          ) : (
            <button 
              className={styles.btnPrimary} 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '初始化中...' : '完成初始化'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../utils/api';
import { useAuth } from '../../components/AuthProvider';
import styles from '../../styles/Init.module.css';

export default function InitPage() {
  const router = useRouter();
  const { ensureLocalSession, appMode } = useAuth();
  const [step, setStep] = useState(1);

  const [config, setConfig] = useState({
    siteName: 'KBird',
    siteDescription: '单机鸟友观鸟笔记本',
    siteUrl: 'http://localhost:13080',
    dbName: 'kbird',
    dbHost: 'localhost',
    dbPort: '27017',
    backendPort: '13082',
    frontendPort: '13080',
    theme: 'default',
    primaryColor: '#219EBC',
    secondaryColor: '#2196F3',
    enableRegistration: false,
    enableComments: true,
    enableUpload: true,
    maxFileSize: '5MB',
    adminUsername: 'admin',
    adminEmail: 'admin@example.com',
    adminPassword: '',
    confirmPassword: '',
    setupToken: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
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

      const result = await api.init.submit(config, { setupToken: config.setupToken });

      if (result.success) {
        localStorage.setItem('init-checked', 'true');
        sessionStorage.removeItem('kbird-skip-auto-login');

        // 单机：立刻本机会话进首页，避免 AuthProvider 只初始化一次导致仍停在登录页
        if (appMode?.autoLogin !== false) {
          const session = await ensureLocalSession();
          if (session?.success) {
            router.replace('/');
            return;
          }
        }

        // 非自动登录或自动登录失败：去登录页，但仍可手输刚建的管理员
        router.replace('/login');
      } else {
        setError(result.message || '初始化失败');
      }
    } catch {
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
          placeholder="http://localhost:13080"
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
          placeholder="13082"
        />
      </div>
      <div className={styles.formGroup}>
        <label>前端端口</label>
        <input
          type="number"
          value={config.frontendPort}
          onChange={(e) => handleInputChange('frontendPort', e.target.value)}
          placeholder="13080"
        />
      </div>
      <div className={styles.formGroup}>
        <label>主题风格</label>
        <select value={config.theme} onChange={(e) => handleInputChange('theme', e.target.value)}>
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
          允许注册本机账号（家人/多身份）
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.enableUpload}
            onChange={(e) => handleInputChange('enableUpload', e.target.checked)}
          />
          允许上传照片与附件
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
      <div className={styles.formGroup}>
        <label>初始化令牌（可选）</label>
        <input
          type="password"
          value={config.setupToken}
          onChange={(e) => handleInputChange('setupToken', e.target.value)}
          placeholder="如后端配置了 INIT_SETUP_TOKEN，请填写"
        />
      </div>
    </div>
  );

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🐦 KBird 初始化设置</h1>
        <p>欢迎使用 KBird！请完成以下配置以开始使用。</p>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${(step / 5) * 100}%` }} />
        </div>
        <span>步骤 {step} / 5</span>
      </div>

      <div className={styles.content}>
        {step === 1 ? renderStep1() : null}
        {step === 2 ? renderStep2() : null}
        {step === 3 ? renderStep3() : null}
        {step === 4 ? renderStep4() : null}
        {step === 5 ? renderStep5() : null}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        {step > 1 ? (
          <button
            className={styles.btnSecondary}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrev();
            }}
            disabled={loading}
          >
            上一步
          </button>
        ) : null}

        {step < 5 ? (
          <button
            className={styles.btnPrimary}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNext();
            }}
            disabled={loading}
            style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            下一步
          </button>
        ) : (
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
            {loading ? '初始化中...' : '完成初始化'}
          </button>
        )}
      </div>
    </div>
  );
}

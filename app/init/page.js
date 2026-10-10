'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../utils/api';
import { useAuth } from '../../components/AuthProvider';
import styles from '../../styles/Init.module.css';

/** 软件名写死；端口 / 主机等走推荐默认，不在向导里改 */
const SITE_NAME = 'KBird';
const DEFAULTS = {
  siteUrl: 'http://localhost:13080',
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
};

function buildDatedDbName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `kbird${y}${m}${d}`;
}

const TOTAL_STEPS = 3;

export default function InitPage() {
  const router = useRouter();
  const { ensureLocalSession, appMode } = useAuth();
  const [step, setStep] = useState(1);

  const [config, setConfig] = useState({
    siteDescription: '观鸟笔记本',
    dbName: buildDatedDbName(),
    baiduMapAk: '',
    tiandituTk: '',
    tiandituServerTk: '',
    openaiApiKey: '',
    openaiBaseUrl: '',
    openaiModel: '',
    hhoApiKey: '',
    hhoApiUrl: '',
    adminUsername: 'admin',
    adminEmail: 'admin@example.com',
    adminPassword: '',
    confirmPassword: '',
    setupToken: '',
    confirmOverwrite: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restartInfo, setRestartInfo] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [alreadyInitialized, setAlreadyInitialized] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.init
      .checkStatus()
      .then((data) => {
        if (data?.success && data.initialized) {
          setAlreadyInitialized(true);
        }
      })
      .catch(() => null);
  }, []);

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const buildPayload = () => ({
    siteName: SITE_NAME,
    siteDescription: config.siteDescription,
    siteUrl: DEFAULTS.siteUrl,
    dbName: config.dbName || buildDatedDbName(),
    dbHost: DEFAULTS.dbHost,
    dbPort: DEFAULTS.dbPort,
    backendPort: DEFAULTS.backendPort,
    frontendPort: DEFAULTS.frontendPort,
    theme: DEFAULTS.theme,
    primaryColor: DEFAULTS.primaryColor,
    secondaryColor: DEFAULTS.secondaryColor,
    enableRegistration: DEFAULTS.enableRegistration,
    enableComments: DEFAULTS.enableComments,
    enableUpload: DEFAULTS.enableUpload,
    maxFileSize: DEFAULTS.maxFileSize,
    baiduMapAk: config.baiduMapAk,
    tiandituTk: config.tiandituTk,
    tiandituServerTk: config.tiandituServerTk,
    openaiApiKey: config.openaiApiKey,
    openaiBaseUrl: config.openaiBaseUrl,
    openaiModel: config.openaiModel,
    hhoApiKey: config.hhoApiKey,
    hhoApiUrl: config.hhoApiUrl,
    adminUsername: config.adminUsername,
    adminEmail: config.adminEmail,
    adminPassword: config.adminPassword,
    confirmOverwrite: Boolean(config.confirmOverwrite),
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setRestartInfo(null);

    try {
      if (alreadyInitialized && !config.confirmOverwrite) {
        setError('请先勾选确认：将覆盖本机原有配置与管理员账号');
        setLoading(false);
        return;
      }

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

      const result = await api.init.submit(buildPayload(), { setupToken: config.setupToken });

      if (result.needsOverwriteConfirm) {
        setAlreadyInitialized(true);
        setError(result.message || '请勾选确认覆盖后再提交');
        setLoading(false);
        return;
      }

      if (result.success && result.initialized) {
        localStorage.setItem('init-checked', 'true');
        sessionStorage.removeItem('kbird-skip-auto-login');

        if (result.restartOptional || result.restartRequired) {
          setRestartInfo({
            done: true,
            optional: true,
            message:
              result.message ||
              '初始化完成，可以开始使用。若配置了地图/AI，建议稍后重启桌面启动脚本后再用相关功能。',
          });
          return;
        }

        if (appMode?.autoLogin !== false) {
          const session = await ensureLocalSession();
          if (session?.success) {
            router.replace('/');
            return;
          }
        }

        router.replace('/login');
      } else {
        setError(result.message || '初始化失败');
      }
    } catch (err) {
      if (err?.status === 409 || err?.data?.needsOverwriteConfirm) {
        setAlreadyInitialized(true);
        setError(err.message || '请勾选确认覆盖后再提交');
      } else {
        setError(err?.message || '网络错误，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className={styles.step}>
      <h2>高级重配（可选）</h2>
      {alreadyInitialized ? (
        <div className={styles.error} style={{ marginBottom: '1rem' }}>
          日常使用不必打开本页。继续操作将覆盖本机原有配置与管理员账号，个人观察数据可能无法在同一库中自动找回。
        </div>
      ) : (
        <p className={styles.hint}>
          一般安装后直接启动即可使用，无需本页。仅在需要重配本机环境时使用。
        </p>
      )}
      <p className={styles.hint}>本机访问地址与数据连接会按推荐默认自动配置。</p>

      <div className={styles.formGroup}>
        <label>软件名称</label>
        <div className={styles.readonlyValue}>{SITE_NAME}</div>
      </div>

      <div className={styles.formGroup}>
        <label>网站描述</label>
        <textarea
          value={config.siteDescription}
          onChange={(e) => handleInputChange('siteDescription', e.target.value)}
          placeholder="例如：观鸟笔记本"
          rows={3}
        />
        <span className={styles.fieldHint}>可按喜好修改。</span>
      </div>

      <div className={styles.formGroup}>
        <label>网站 URL</label>
        <div className={styles.readonlyValue}>{DEFAULTS.siteUrl}</div>
        <span className={styles.fieldHint}>建议保持默认，进阶改端口可日后手改配置后重启。</span>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.step}>
      <h2>地图与 AI（可选）</h2>
      <p className={styles.hint}>
        均可跳过，直接下一步。留空不写密钥；以后可在「个人设置 → 服务与密钥」填写，保存后重启
        KBird-Desktop.bat。
      </p>
      <details>
        <summary style={{ cursor: 'pointer', marginBottom: '0.75rem', fontWeight: 600 }}>
          地图 Key（可跳过）
        </summary>
        <div className={styles.formGroup}>
          <label>百度地图 AK</label>
          <input
            type="password"
            value={config.baiduMapAk}
            onChange={(e) => handleInputChange('baiduMapAk', e.target.value)}
            placeholder="有 Key 再填，否则留空"
            autoComplete="off"
          />
        </div>
        <div className={styles.formGroup}>
          <label>天地图浏览器 TK</label>
          <input
            type="password"
            value={config.tiandituTk}
            onChange={(e) => handleInputChange('tiandituTk', e.target.value)}
            placeholder="有 Key 再填，否则留空"
            autoComplete="off"
          />
        </div>
        <div className={styles.formGroup}>
          <label>天地图服务端 TK</label>
          <input
            type="password"
            value={config.tiandituServerTk}
            onChange={(e) => handleInputChange('tiandituServerTk', e.target.value)}
            placeholder="可选"
            autoComplete="off"
          />
        </div>
      </details>
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', marginBottom: '0.75rem', fontWeight: 600 }}>
          AI Key（可跳过）
        </summary>
        <div className={styles.formGroup}>
          <label>OpenAI API Key</label>
          <input
            type="password"
            value={config.openaiApiKey}
            onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
            placeholder="有 Key 再填，否则留空"
            autoComplete="off"
          />
        </div>
        <div className={styles.formGroup}>
          <label>OpenAI Base URL</label>
          <input
            type="text"
            value={config.openaiBaseUrl}
            onChange={(e) => handleInputChange('openaiBaseUrl', e.target.value)}
            placeholder="可选，默认服务商地址"
          />
        </div>
        <div className={styles.formGroup}>
          <label>OpenAI Model</label>
          <input
            type="text"
            value={config.openaiModel}
            onChange={(e) => handleInputChange('openaiModel', e.target.value)}
            placeholder="可选"
          />
        </div>
        <div className={styles.formGroup}>
          <label>花合鸟 HHO API Key</label>
          <input
            type="password"
            value={config.hhoApiKey}
            onChange={(e) => handleInputChange('hhoApiKey', e.target.value)}
            placeholder="可选"
            autoComplete="off"
          />
        </div>
        <div className={styles.formGroup}>
          <label>HHO API URL</label>
          <input
            type="text"
            value={config.hhoApiUrl}
            onChange={(e) => handleInputChange('hhoApiUrl', e.target.value)}
            placeholder="可选"
          />
        </div>
      </details>
    </div>
  );

  const renderStep3 = () => (
    <div className={styles.step}>
      <h2>管理员账户</h2>
      <p className={styles.hint}>本机管理员账号可按需要修改；密码请自行设置并牢记。</p>

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
        <label>初始化令牌</label>
        <input
          type="password"
          value={config.setupToken}
          onChange={(e) => handleInputChange('setupToken', e.target.value)}
          placeholder="本机单机通常留空"
          autoComplete="off"
        />
        <span className={styles.fieldHint}>一般可留空。</span>
      </div>
      {alreadyInitialized ? (
        <label className={styles.checkboxLabel || undefined} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={config.confirmOverwrite}
            onChange={(e) => handleInputChange('confirmOverwrite', e.target.checked)}
          />
          <span>我已了解风险，确认覆盖本机原有配置与管理员账号</span>
        </label>
      ) : null}
    </div>
  );

  if (!mounted) return null;

  if (restartInfo) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>KBird 初始化</h1>
          <p>设置完成</p>
        </div>
        <div className={styles.content}>
          <div className={styles.step}>
            <h2>可以开始使用了</h2>
            <p className={styles.hint}>{restartInfo.message}</p>
            {restartInfo.optional ? (
              <p className={styles.hint}>
                数据库与管理员已就绪，无需再次初始化。地图 / AI 若暂不可用，关掉窗口后重新运行
                KBird-Desktop.bat 即可。
              </p>
            ) : null}
            <div className={styles.actions} style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={async () => {
                  if (appMode?.autoLogin !== false) {
                    const session = await ensureLocalSession();
                    if (session?.success) {
                      router.replace('/');
                      return;
                    }
                  }
                  router.replace('/login');
                }}
              >
                进入应用
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>KBird 高级重配</h1>
        <p>日常请直接使用首页。本页仅用于特殊情况重配，可能覆盖原有设置。</p>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <span>
          步骤 {step} / {TOTAL_STEPS}
        </span>
      </div>

      <div className={styles.content}>
        {step === 1 ? renderStep1() : null}
        {step === 2 ? renderStep2() : null}
        {step === 3 ? renderStep3() : null}
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

        {step < TOTAL_STEPS ? (
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
            {step === 2 ? '跳过 / 下一步' : '下一步'}
          </button>
        ) : (
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : alreadyInitialized ? '确认覆盖并重配' : '完成重配'}
          </button>
        )}
      </div>
    </div>
  );
}

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

const TOTAL_STEPS = 4;

export default function InitPage() {
  const router = useRouter();
  const { ensureLocalSession, appMode } = useAuth();
  const [step, setStep] = useState(1);

  const [config, setConfig] = useState({
    siteDescription: '观鸟笔记本',
    dbName: 'kbird',
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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restartInfo, setRestartInfo] = useState(null);
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
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const buildPayload = () => ({
    siteName: SITE_NAME,
    siteDescription: config.siteDescription,
    siteUrl: DEFAULTS.siteUrl,
    dbName: String(config.dbName || '').trim() || 'kbird',
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
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setRestartInfo(null);

    try {
      const dbName = String(config.dbName || '').trim();
      if (!dbName) {
        setError('请填写数据库名称');
        setLoading(false);
        return;
      }
      if (!/^[A-Za-z0-9._-]+$/.test(dbName)) {
        setError('数据库名称仅允许字母、数字、点、下划线、短横线');
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

      if (result.success && result.restartRequired && (result.dbChanged || !result.initialized)) {
        setRestartInfo({
          dbChanged: Boolean(result.dbChanged),
          message:
            result.message ||
            '配置已写入本机 .env。请关闭并重新运行 KBird-Desktop.bat，再打开 /init 完成管理员创建。',
        });
        return;
      }

      if (result.success && result.initialized) {
        localStorage.setItem('init-checked', 'true');
        sessionStorage.removeItem('kbird-skip-auto-login');

        if (result.restartRequired) {
          setRestartInfo({
            dbChanged: false,
            done: true,
            message:
              result.message ||
              '初始化完成。部分密钥已写入 .env，请重启 KBird-Desktop.bat 后地图/AI 才会生效。',
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
      } else if (result.success) {
        setRestartInfo({
          dbChanged: Boolean(result.dbChanged),
          message: result.message || '请按提示重启后再继续。',
        });
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
      <h2>基本信息</h2>
      <p className={styles.hint}>软件名固定为 KBird。本机访问地址建议保持默认，一般无需改动。</p>

      <div className={styles.formGroup}>
        <label>软件名称</label>
        <div className={styles.readonlyValue}>{SITE_NAME}</div>
        <span className={styles.fieldHint}>产品名称，不可修改。</span>
      </div>

      <div className={styles.formGroup}>
        <label>网站描述</label>
        <textarea
          value={config.siteDescription}
          onChange={(e) => handleInputChange('siteDescription', e.target.value)}
          placeholder="例如：观鸟笔记本"
          rows={3}
        />
        <span className={styles.fieldHint}>可按喜好修改，会写入本机 .env。</span>
      </div>

      <div className={styles.formGroup}>
        <label>网站 URL</label>
        <div className={styles.readonlyValue}>{DEFAULTS.siteUrl}</div>
        <span className={styles.fieldHint}>
          建议保持默认（桌面版前端端口 13080）。进阶改端口请手改 .env 后重启。
        </span>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.step}>
      <h2>数据库</h2>
      <p className={styles.hint}>
        库名将写入本机 <code>.env</code> 的 <code>MONGODB_URI</code>。主机与端口使用推荐默认，本机 MongoDB
        一般不用改。
      </p>

      <div className={styles.formGroup}>
        <label>数据库名称</label>
        <input
          type="text"
          value={config.dbName}
          onChange={(e) => handleInputChange('dbName', e.target.value)}
          placeholder="kbird"
        />
        <span className={styles.fieldHint}>
          默认 <code>kbird</code>。若改成与当前运行中不同的库，完成后需先重启再创建管理员。
        </span>
      </div>

      <div className={styles.defaultsBox}>
        以下使用默认值，可直接点「下一步」：
        <br />
        主机 <code>{DEFAULTS.dbHost}</code> · 端口 <code>{DEFAULTS.dbPort}</code>
        <br />
        前端 <code>{DEFAULTS.frontendPort}</code> · 后端 <code>{DEFAULTS.backendPort}</code>
      </div>
    </div>
  );

  const renderStep3 = () => (
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
            placeholder="可选，如 gpt-4o-mini"
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

  const renderStep4 = () => (
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
        <span className={styles.fieldHint}>
          仅当 .env 里配置了 INIT_SETUP_TOKEN 时才需要填写，一般可跳过。
        </span>
      </div>
    </div>
  );

  if (!mounted) return null;

  if (restartInfo) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>KBird 初始化</h1>
          <p>{restartInfo.done ? '管理员已创建' : '需要重启后继续'}</p>
        </div>
        <div className={styles.content}>
          <div className={styles.step}>
            <h2>{restartInfo.dbChanged ? '请先重启以切换数据库' : '请重启使配置生效'}</h2>
            <p className={styles.hint}>{restartInfo.message}</p>
            <ol style={{ lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>关闭当前前后端窗口（或运行 KBird-Stop.bat）</li>
              <li>重新双击运行 KBird-Desktop.bat（或生产版 bat）</li>
              {!restartInfo.done ? (
                <li>浏览器再打开 http://localhost:13080/init 完成管理员创建</li>
              ) : null}
              {restartInfo.done ? <li>重启后打开首页即可使用地图 / AI 等能力</li> : null}
            </ol>
            {restartInfo.done ? (
              <div className={styles.actions} style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => router.replace('/login')}
                >
                  前往登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>KBird 初始化</h1>
        <p>只需确认必要项；端口等已用推荐默认，可直接下一步。</p>
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
        {step === 4 ? renderStep4() : null}
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
            {step === 3 ? '跳过 / 下一步' : '下一步'}
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

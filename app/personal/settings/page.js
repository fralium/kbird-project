'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader from '../../../components/SimplePageHeader';
import PageState from '../../../components/PageState';
import AvatarUpload from '../../../components/AvatarUpload';
import { useAuth } from '../../../components/AuthProvider';
import { api } from '../../../utils/api';
import { UI_STYLES, applyUiStyle, isValidUiStyle } from '../../../utils/uiStyle';
import styles from '../../../styles/PersonalSettings.module.css';

const VALID_TABS = ['account', 'favorites', 'app'];

function PersonalSettingsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser, setUserData } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    bio: '',
    location: '',
    website: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [resetConfirmUntil, setResetConfirmUntil] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesFetched, setFavoritesFetched] = useState(false);
  const hasRedirectedRef = useRef(false);

  const tabParam = searchParams?.get('tab');
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'account';

  const setActiveTab = (tab) => {
    const next = VALID_TABS.includes(tab) ? tab : 'account';
    const qs = next === 'account' ? '' : `?tab=${next}`;
    router.replace(`/personal/settings${qs}`, { scroll: false });
  };

  const routerPushRef = useRef(router.push);
  useEffect(() => {
    routerPushRef.current = router.push;
  }, [router.push]);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        routerPushRef.current('/login?redirect=/personal/settings');
      }
      setLoading(false);
      return;
    }

    if (!user) {
      const hasCachedUser = typeof window !== 'undefined' && localStorage.getItem('user');
      if (refreshUser) {
        refreshUser().catch(() => null);
      }
      if (!hasCachedUser) {
        setLoading(false);
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          routerPushRef.current('/login?redirect=/personal/settings');
        }
      }
      return;
    }

    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      bio: user.bio || '',
      location: user.location || '',
      website: user.website || '',
    });
    fetchSettings();
  }, [authLoading, refreshUser, user]);

  useEffect(() => {
    if (activeTab === 'favorites' && user && !favoritesFetched) {
      fetchFavorites();
    }
  }, [activeTab, user, favoritesFetched]);

  const showMessage = (text, duration = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(''), duration);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    const name = (profileForm.name || '').trim();
    if (!name) {
      showMessage('显示名称不能为空', 2000);
      return;
    }
    setSavingProfile(true);
    setMessage('');
    try {
      const data = await api.users.updateProfile({
        name,
        email: (profileForm.email || '').trim(),
        bio: profileForm.bio || '',
        location: profileForm.location || '',
        website: profileForm.website || '',
      });
      if (data.success) {
        if (setUserData && data.data) {
          setUserData(data.data);
        } else if (refreshUser) {
          await refreshUser();
        }
        showMessage('资料已更新');
      } else {
        showMessage(data.message || '更新失败');
      }
    } catch (error) {
      showMessage(error.message || '更新失败，请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = (newAvatar) => {
    if (user && setUserData) {
      setUserData({ ...user, avatar: newAvatar });
    } else if (refreshUser) {
      refreshUser().catch(() => null);
    }
  };

  const handleSavePassword = async () => {
    const cur = (currentPassword || '').trim();
    const newP = (newPassword || '').trim();
    const conf = (confirmPassword || '').trim();
    if (!cur) {
      showMessage('请输入当前密码', 2000);
      return;
    }
    if (newP.length < 6) {
      showMessage('新密码至少 6 位', 2000);
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newP)) {
      showMessage('新密码需同时包含小写字母、大写字母和数字', 3000);
      return;
    }
    if (newP !== conf) {
      showMessage('两次输入的新密码不一致', 2000);
      return;
    }
    setSavingPassword(true);
    setMessage('');
    try {
      const data = await api.users.updateProfile({
        currentPassword: cur,
        password: newP,
      });
      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showMessage('密码已更新，请使用新密码登录', 4000);
      } else {
        showMessage(data.message || '修改失败', 4000);
      }
    } catch (error) {
      showMessage(error.message || '修改失败，请重试', 4000);
    } finally {
      setSavingPassword(false);
    }
  };

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const data = await api.users.getFavorites();
      if (data.success) {
        setFavorites(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('获取收藏失败:', error);
      showMessage(error.message || '获取收藏失败');
    } finally {
      setFavoritesLoading(false);
      setFavoritesFetched(true);
    }
  };

  const applyTheme = (theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark-theme');
      } else {
        root.classList.remove('dark-theme');
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await api.personal.getSettings();
      if (data.success) {
        setSettings(data.data);
        if (isValidUiStyle(data.data?.uiStyle)) {
          applyUiStyle(data.data.uiStyle);
        }
        if (data.data?.theme) {
          applyTheme(data.data.theme);
        }
      }
    } catch (error) {
      console.error('获取设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section, key, value) => {
    setSettings((prev) => {
      const current = prev?.[section];
      const isNestedObject =
        current != null && typeof current === 'object' && !Array.isArray(current);
      if (!isNestedObject || section === key) {
        return { ...prev, [section]: value };
      }
      return {
        ...prev,
        [section]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const handleUiStyleChange = (styleId) => {
    if (!isValidUiStyle(styleId)) return;
    applyUiStyle(styleId);
    setSettings((prev) => ({ ...prev, uiStyle: styleId }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const data = await api.personal.updateSettings(settings);
      if (data.success) {
        setMessage('设置已保存');
        setSettings(data.data);
        if (data.data?.theme) {
          applyTheme(data.data.theme);
        }
        if (isValidUiStyle(data.data?.uiStyle)) {
          applyUiStyle(data.data.uiStyle);
        }
      } else {
        setMessage(`保存失败：${data.message}`);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      setMessage('保存失败，请重试');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleReset = async () => {
    const now = Date.now();
    if (resetConfirmUntil <= now) {
      setResetConfirmUntil(now + 6000);
      setMessage('再次点击“重置为默认值”确认重置（6秒内有效）');
      return;
    }

    try {
      const data = await api.personal.resetSettings();
      if (data.success) {
        setSettings(data.data);
        setMessage('设置已重置为默认值');
        applyTheme('light');
        applyUiStyle(data.data?.uiStyle || 'wetland');
      }
    } catch (error) {
      console.error('重置设置失败:', error);
      setMessage('重置失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="个人设置加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在前往登录..." />
        </main>
        <Footer />
      </div>
    );
  }

  const messageIsSuccess =
    message.includes('成功') || message.includes('已更新') || message.includes('已重置');

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="个人设置"
          description="账号与本机偏好"
          descriptionVariant="caption"
        />

        {message ? (
          <div className={`${styles.message} ${messageIsSuccess ? styles.success : styles.error}`}>
            {message}
          </div>
        ) : null}

        <div className="kb-view-bar" role="tablist" aria-label="设置分类">
          <div className="kb-view-seg">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'account'}
              className={`kb-view-tab${activeTab === 'account' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              账号资料
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'favorites'}
              className={`kb-view-tab${activeTab === 'favorites' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              我的收藏
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'app'}
              className={`kb-view-tab${activeTab === 'app' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('app')}
            >
              应用偏好
            </button>
          </div>
          <p className="kb-view-hint">
            {activeTab === 'account'
              ? '头像、昵称和账号信息。'
              : activeTab === 'favorites'
                ? '收藏的鸟种。'
                : '地图、显示等本机偏好。'}
          </p>
        </div>

        {activeTab === 'account' ? (
          <div className={styles.settingsContent} role="tabpanel">
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>头像</h2>
              <div className={styles.avatarSection}>
                <AvatarUpload currentAvatar={user?.avatar} onAvatarChange={handleAvatarChange} />
              </div>
            </div>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>账号信息</h2>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <label className={styles.settingLabel} htmlFor="profile-name">
                  显示名称
                </label>
                <input
                  id="profile-name"
                  type="text"
                  name="name"
                  value={profileForm.name}
                  onChange={handleProfileChange}
                  placeholder="本账号显示名称"
                  className={styles.settingInput}
                  maxLength={50}
                />
              </div>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <label className={styles.settingLabel} htmlFor="profile-email">
                  邮箱
                </label>
                <input
                  id="profile-email"
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  className={styles.settingInput}
                  autoComplete="email"
                />
              </div>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <label className={styles.settingLabel} htmlFor="profile-bio">
                  个人简介
                </label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={profileForm.bio}
                  onChange={handleProfileChange}
                  className={styles.settingTextarea}
                  rows={3}
                  placeholder="介绍一下自己..."
                />
              </div>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <label className={styles.settingLabel} htmlFor="profile-location">
                  所在地
                </label>
                <input
                  id="profile-location"
                  type="text"
                  name="location"
                  value={profileForm.location}
                  onChange={handleProfileChange}
                  className={styles.settingInput}
                  placeholder="例如：北京"
                />
              </div>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <label className={styles.settingLabel} htmlFor="profile-website">
                  备注链接（可选）
                </label>
                <input
                  id="profile-website"
                  type="url"
                  name="website"
                  value={profileForm.website}
                  onChange={handleProfileChange}
                  className={styles.settingInput}
                  placeholder="https://example.com"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={styles.saveNameButton}
              >
                {savingProfile ? '保存中...' : '保存资料'}
              </button>
              <p className={styles.settingHint}>用于导航栏与记录中的观察者显示。</p>
            </div>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>修改密码</h2>
              <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                <div className={styles.passwordRow}>
                  <label className={styles.settingLabel}>当前密码</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="当前密码"
                    className={styles.settingInput}
                    autoComplete="current-password"
                  />
                </div>
                <div className={styles.passwordRow}>
                  <label className={styles.settingLabel}>新密码</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 位，含大小写字母和数字"
                    className={styles.settingInput}
                    autoComplete="new-password"
                  />
                </div>
                <div className={styles.passwordRow}>
                  <label className={styles.settingLabel}>确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className={styles.settingInput}
                    autoComplete="new-password"
                  />
                </div>
                <p className={styles.settingHint}>密码至少 6 位，需同时包含小写字母、大写字母和数字。</p>
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={
                    savingPassword ||
                    !currentPassword ||
                    newPassword.length < 6 ||
                    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword) ||
                    newPassword !== confirmPassword
                  }
                  className={styles.saveNameButton}
                >
                  {savingPassword ? '保存中...' : '修改密码'}
                </button>
                <p className={styles.settingHint}>修改成功后请使用新密码登录。</p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'favorites' ? (
          <div className={styles.settingsContent} role="tabpanel">
            <div className={styles.favoritesHeader}>
              <h2 className={styles.sectionTitle}>我的收藏</h2>
              <Link href="/birds" className={styles.browseButton}>
                浏览鸟类
              </Link>
            </div>
            {favoritesLoading ? (
              <PageState type="loading" title="加载收藏中..." />
            ) : (
              <div className={styles.favoriteList}>
                {(Array.isArray(favorites) ? favorites : []).map((bird, index) => (
                  <div
                    key={
                      bird?._id ||
                      `${bird?.name || 'unknown'}-${bird?.scientificName || 'na'}-${index}`
                    }
                    className={styles.favoriteItem}
                  >
                    <Link href={`/birds/${bird?._id || ''}`}>
                      <h3>{bird.name}</h3>
                      <p>{bird.scientificName}</p>
                    </Link>
                  </div>
                ))}
                {favorites.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>还没有收藏任何鸟类</p>
                    <Link href="/birds" className={styles.emptyAction}>
                      开始收藏
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'app' ? (
          settings ? (
            <div className={styles.settingsContent} role="tabpanel">
              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>外观设置</h2>
                <div className={`${styles.settingItem} ${styles.settingItemBlock}`}>
                  <label className={styles.settingLabel} id="ui-style-label">
                    界面风格
                  </label>
                  <p className={styles.settingHint}>
                    切换色板气质；默认湿地晨曦。深林静影对应方案 C 方向，可随时换回。
                  </p>
                  <div
                    className={styles.styleGrid}
                    role="radiogroup"
                    aria-labelledby="ui-style-label"
                  >
                    {UI_STYLES.map((item) => {
                      const selected = (settings.uiStyle || 'wetland') === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`${styles.styleOption} ${selected ? styles.styleOptionActive : ''}`}
                          data-style={item.id}
                          onClick={() => handleUiStyleChange(item.id)}
                        >
                          <span className={styles.styleSwatch} aria-hidden="true">
                            <span className={styles.styleSwatchA} />
                            <span className={styles.styleSwatchB} />
                            <span className={styles.styleSwatchC} />
                          </span>
                          <span className={styles.styleOptionText}>
                            <span className={styles.styleOptionLabel}>{item.label}</span>
                            <span className={styles.styleOptionHint}>{item.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>明暗</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => handleChange('theme', 'theme', e.target.value)}
                    className={styles.settingSelect}
                  >
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                    <option value="auto">跟随系统</option>
                  </select>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>语言</label>
                  <select
                    value={settings.language}
                    onChange={(e) => handleChange('language', 'language', e.target.value)}
                    className={styles.settingSelect}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>格式设置</h2>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>日期格式</label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => handleChange('dateFormat', 'dateFormat', e.target.value)}
                    className={styles.settingSelect}
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  </select>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>温度单位</label>
                  <select
                    value={settings.units.temperature}
                    onChange={(e) => handleChange('units', 'temperature', e.target.value)}
                    className={styles.settingSelect}
                  >
                    <option value="celsius">摄氏度 (°C)</option>
                    <option value="fahrenheit">华氏度 (°F)</option>
                  </select>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>距离单位</label>
                  <select
                    value={settings.units.distance}
                    onChange={(e) => handleChange('units', 'distance', e.target.value)}
                    className={styles.settingSelect}
                  >
                    <option value="metric">公制 (km, m)</option>
                    <option value="imperial">英制 (mi, ft)</option>
                  </select>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>提醒偏好（预留）</h2>
                <p className={styles.settingHint}>
                  当前为本机部署，尚无推送通道；选项先保留，便于以后接本地提醒。
                </p>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.notifications.goals}
                      onChange={(e) => handleChange('notifications', 'goals', e.target.checked)}
                      className={styles.checkbox}
                    />
                    目标进度提醒
                  </label>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.notifications.backups}
                      onChange={(e) => handleChange('notifications', 'backups', e.target.checked)}
                      className={styles.checkbox}
                    />
                    数据备份提醒
                  </label>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.notifications.reports}
                      onChange={(e) => handleChange('notifications', 'reports', e.target.checked)}
                      className={styles.checkbox}
                    />
                    统计报告提醒
                  </label>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.notifications.weeklySummary}
                      onChange={(e) =>
                        handleChange('notifications', 'weeklySummary', e.target.checked)
                      }
                      className={styles.checkbox}
                    />
                    每周摘要
                  </label>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>显示设置</h2>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>每页显示数量</label>
                  <select
                    value={settings.display.itemsPerPage}
                    onChange={(e) =>
                      handleChange('display', 'itemsPerPage', parseInt(e.target.value, 10))
                    }
                    className={styles.settingSelect}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.display.showThumbnails}
                      onChange={(e) =>
                        handleChange('display', 'showThumbnails', e.target.checked)
                      }
                      className={styles.checkbox}
                    />
                    显示缩略图
                  </label>
                </div>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.display.compactMode}
                      onChange={(e) => handleChange('display', 'compactMode', e.target.checked)}
                      className={styles.checkbox}
                    />
                    紧凑模式
                  </label>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h2 className={styles.sectionTitle}>数据能力</h2>
                <div className={styles.settingItem}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.privacy.allowDataExport}
                      onChange={(e) =>
                        handleChange('privacy', 'allowDataExport', e.target.checked)
                      }
                      className={styles.checkbox}
                    />
                    允许导出个人档案（备份页）
                  </label>
                </div>
                <p className={styles.settingHint}>
                  本机多账号场景不做公开展示；邮箱与地点仅本账号可见。
                </p>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={handleSave} disabled={saving} className={styles.saveButton}>
                  {saving ? '保存中...' : '保存设置'}
                </button>
                <button type="button" onClick={handleReset} className={styles.resetButton}>
                  重置为默认值
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.settingsContent} role="tabpanel">
              <div className={styles.emptyState}>
                <p>无法加载应用偏好，请刷新重试</p>
              </div>
            </div>
          )
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

export default function PersonalSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="个人设置加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <PersonalSettingsPageClient />
    </Suspense>
  );
}

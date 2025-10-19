import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AvatarUpload from '../components/AvatarUpload';
import { useUser } from '../utils/userContext';
import styles from '../styles/Dashboard.module.css';
import { api, apiRequest } from '../utils/api';

export default function Dashboard() {
  const router = useRouter();
  const { user: globalUser, loading: userLoading } = useUser();
  const [contributions, setContributions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [records, setRecords] = useState([]);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [hasFetchedData, setHasFetchedData] = useState(false); // 防止重复请求
  const hasFetchedRef = useRef(false); // 使用ref避免闭包问题
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    location: '',
    website: ''
  });

  useEffect(() => {
    // 检查用户是否登录
    if (!userLoading && !globalUser) {
      router.push('/login');
      return;
    }
    
    if (globalUser && !hasFetchedRef.current) {
      // 设置表单数据
      setFormData({
        name: globalUser.name || '',
        email: globalUser.email || '',
        bio: globalUser.bio || '',
        location: globalUser.location || '',
        website: globalUser.website || ''
      });
      
      // 获取其他数据
      const token = localStorage.getItem('token');
      if (token) {
        fetchUserData(token);
        hasFetchedRef.current = true; // 使用ref标记已获取数据
        setHasFetchedData(true);
      }
    }
  }, [globalUser, userLoading]); // 移除hasFetchedData依赖，避免循环

  // 单独处理URL参数变化
  useEffect(() => {
    if (router.query.tab) {
      const validTabs = ['overview', 'profile', 'contributions', 'favorites', 'pending'];
      if (validTabs.includes(router.query.tab)) {
        setActiveTab(router.query.tab);
      }
    }
  }, [router.query.tab]);

  const fetchUserData = async (token) => {
    setLoading(true);
    try {
      // 表单数据已在useEffect中设置，这里不需要重复设置

      // 获取用户贡献
      const contributionsResponse = await api.users.getContributions();
      
      if (contributionsResponse.success) {
        setContributions(contributionsResponse.data || []);
      }

      // 获取用户收藏
      const favoritesResponse = await api.users.getFavorites();
      
      if (favoritesResponse.success) {
        setFavorites(favoritesResponse.data || []);
      }

      // 获取当前用户的观鸟记录统计数据
      const recordsData = await apiRequest(`/api/records/user/${globalUser.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (recordsData.success) {
        const allRecords = recordsData.data || [];
        // 只在开发环境下打印详细日志
        if (process.env.NODE_ENV === 'development') {
          console.log('获取到的观鸟记录:', allRecords);
          console.log('记录数量:', allRecords.length);
          console.log('已通过记录:', allRecords.filter(r => r.status === 'approved').length);
          console.log('待审核记录:', allRecords.filter(r => r.status === 'pending').length);
        }
        setRecords(allRecords);
        setPendingRecords(allRecords.filter(r => r.status === 'pending'));
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
      
      // 如果是限流错误，显示友好提示
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        console.warn('API请求被限流，请等待15秒后刷新页面');
        // 可以在这里显示一个用户友好的提示
        return;
      }
      
      // 如果token无效，重定向到登录页面
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('HTTP error! status: 401')) {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data);
        setEditing(false);
        alert('资料更新成功！');
      } else {
        alert(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  };

  const handleAvatarChange = (newAvatar) => {
    setUser(prev => ({
      ...prev,
      avatar: newAvatar
    }));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>用户中心 - KBird</title>
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loading}>
            <p>加载中...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>用户中心 - KBird</title>
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* 新的欢迎区域设计 */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeCard}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>
                欢迎回来，<span className={styles.userName}>{globalUser?.name || '观鸟爱好者'}</span>！
              </h1>
              <p className={styles.welcomeSubtitle}>
                管理您的鸟类观察记录和收藏
              </p>
            </div>
            <div className={styles.welcomeStats}>
              <div className={styles.statItem}>
                <span className={styles.statNumber}>{records.length}</span>
                <span className={styles.statLabel}>观察记录</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statNumber}>{new Set(records.flatMap(r => r.birds.map(b => b.birdId._id))).size}</span>
                <span className={styles.statLabel}>观察鸟类</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statNumber}>{favorites.length}</span>
                <span className={styles.statLabel}>收藏鸟类</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statNumber}>{pendingRecords.length}</span>
                <span className={styles.statLabel}>待审核</span>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className={styles.tabNavigation}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 概览
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 个人资料
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'contributions' ? styles.active : ''}`}
            onClick={() => setActiveTab('contributions')}
          >
            🐦 我的贡献
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'favorites' ? styles.active : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            🪶 我的收藏
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'pending' ? styles.active : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            📋 审核状态
          </button>
        </div>

        {/* 概览标签页 */}
        {activeTab === 'overview' && (
          <div className={styles.tabContent}>
            <div className={styles.quickActions}>
              <div className={styles.actionCard}>
                <h2>📊 观察统计</h2>
                <p>查看您的观鸟活动统计</p>
                <div className={styles.statsMini}>
                  <Link href="/records" className={styles.statItem}>
                    <span className={styles.statNumber}>
                      {records.filter(record => {
                        const recordDate = new Date(record.date);
                        const now = new Date();
                        return recordDate.getMonth() === now.getMonth() && 
                               recordDate.getFullYear() === now.getFullYear();
                      }).length}
                    </span>
                    <span className={styles.statLabel}>本月观察</span>
                  </Link>
                  <Link href="/records" className={styles.statItem}>
                    <span className={styles.statNumber}>
                      {records.filter(record => {
                        const recordDate = new Date(record.date);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return recordDate >= weekAgo;
                      }).length}
                    </span>
                    <span className={styles.statLabel}>本周观察</span>
                  </Link>
                </div>
              </div>
              <div className={styles.actionCard}>
                <h2>📋 审核状态</h2>
                <p>查看您的观鸟记录审核进度</p>
                <div className={styles.statsMini}>
                  <Link href="/dashboard?tab=pending" className={styles.statItem}>
                    <span className={styles.statNumber}>
                      {pendingRecords.length}
                    </span>
                    <span className={styles.statLabel}>待审核</span>
                  </Link>
                  <Link href="/dashboard?tab=pending" className={styles.statItem}>
                    <span className={styles.statNumber}>
                      {records.filter(r => r.status === 'approved').length}
                    </span>
                    <span className={styles.statLabel}>已通过</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 个人资料标签页 */}
        {activeTab === 'profile' && (
          <div className={styles.tabContent}>
            <div className={styles.profileContent}>
              <div className={styles.avatarSection}>
                <h2>头像设置</h2>
                <AvatarUpload 
                  currentAvatar={globalUser?.avatar}
                  onAvatarChange={handleAvatarChange}
                />
              </div>

              <div className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                  <h2>基本信息</h2>
                  {!editing ? (
                    <button 
                      onClick={() => setEditing(true)}
                      className={styles.editButton}
                    >
                      ✏️ 编辑
                    </button>
                  ) : (
                    <div className={styles.actionButtons}>
                      <button 
                        onClick={handleSave}
                        className={styles.saveButton}
                      >
                        💾 保存
                      </button>
                      <button 
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            name: globalUser?.name || '',
                            email: globalUser?.email || '',
                            bio: globalUser?.bio || '',
                            location: globalUser?.location || '',
                            website: globalUser?.website || ''
                          });
                        }}
                        className={styles.cancelButton}
                      >
                        ❌ 取消
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <label>用户名</label>
                    {editing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={styles.input}
                      />
                    ) : (
                      <span className={styles.value}>{globalUser?.name}</span>
                    )}
                  </div>

                  <div className={styles.infoItem}>
                    <label>邮箱</label>
                    {editing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={styles.input}
                      />
                    ) : (
                      <span className={styles.value}>{globalUser?.email}</span>
                    )}
                  </div>

                  <div className={styles.infoItem}>
                    <label>个人简介</label>
                    {editing ? (
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        className={styles.textarea}
                        rows="3"
                        placeholder="介绍一下自己..."
                      />
                    ) : (
                      <span className={styles.value}>{globalUser?.bio || '暂无简介'}</span>
                    )}
                  </div>

                  <div className={styles.infoItem}>
                    <label>所在地</label>
                    {editing ? (
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="例如：北京"
                      />
                    ) : (
                      <span className={styles.value}>{globalUser?.location || '未设置'}</span>
                    )}
                  </div>

                  <div className={styles.infoItem}>
                    <label>个人网站</label>
                    {editing ? (
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="https://example.com"
                      />
                    ) : (
                      <span className={styles.value}>
                        {globalUser?.website ? (
                          <a href={globalUser?.website} target="_blank" rel="noopener noreferrer">
                            {globalUser?.website}
                          </a>
                        ) : (
                          '未设置'
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.accountActions}>
              <div className={styles.actionCard}>
                <h2>⚙️ 账户设置</h2>
                <p>管理您的账户和安全设置</p>
                <div className={styles.settingsActions}>
                  <button className={styles.settingsButton}>
                    修改密码
                  </button>
                  <button 
                    className={styles.logoutButton}
                    onClick={handleLogout}
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 我的贡献标签页 */}
        {activeTab === 'contributions' && (
          <div className={styles.tabContent}>
            <div className={styles.contentHeader}>
              <h2>我的记录</h2>
              <p>您记录的观鸟次数统计</p>
            </div>
            <div className={styles.observationStats}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{records.length}</div>
                  <div className={styles.statLabel}>观察记录</div>
                  <div className={styles.statDescription}>您的观鸟记录总数</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>
                    {new Set(records.flatMap(r => r.birds.map(b => b.birdId._id))).size}
                  </div>
                  <div className={styles.statLabel}>观察鸟类</div>
                  <div className={styles.statDescription}>全站观察到的鸟类种类</div>
                </div>
              </div>
              
              <div className={styles.recentObservations}>
                <h3>最近的观察记录</h3>
                <div className={styles.observationList}>
                  {records.slice(0, 10).map((record) => (
                    <div key={record._id} className={styles.observationItem}>
                      <div className={styles.observationInfo}>
                        <h4>{record.title}</h4>
                        <p>{record.location.name}</p>
                        <p className={styles.observationLocation}>
                          {record.birds.length} 种鸟类: {record.birds.map(b => b.birdId.name).join(', ')}
                        </p>
                        <p className={styles.observationDate}>
                          {new Date(record.date).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <div className={styles.observationStatus}>
                        <span className={`${styles.statusBadge} ${styles[record.status]}`}>
                          {record.status === 'pending' && '⏳ 待审核'}
                          {record.status === 'approved' && '✅ 已通过'}
                          {record.status === 'rejected' && '❌ 已拒绝'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {records.length === 0 && (
                    <div className={styles.emptyState}>
                      <p>还没有记录任何观鸟活动</p>
                      <Link href="/records/add" className={styles.emptyAction}>
                        开始记录
                      </Link>
                    </div>
                  )}
                </div>
                {records.length > 10 && (
                  <div className={styles.viewAllContainer}>
                    <Link href="/records" className={styles.viewAllButton}>
                      查看全部记录 →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 我的收藏标签页 */}
        {activeTab === 'favorites' && (
          <div className={styles.tabContent}>
            <div className={styles.contentHeader}>
              <h2>我的收藏</h2>
              <Link href="/birds" className={styles.browseButton}>
                🔍 浏览鸟类
              </Link>
            </div>
            <div className={styles.favoriteList}>
              {favorites.map((bird) => (
                <div key={bird._id} className={styles.favoriteItem}>
                  <Link href={`/birds/${bird._id}`}>
                    <h3>{bird.name}</h3>
                    <p>{bird.scientificName}</p>
                  </Link>
                </div>
              ))}
              {favorites.length === 0 && (
                <div className={styles.emptyState}>
                  <p>还没有收藏任何鸟类</p>
                  <Link href="/birds" className={styles.emptyAction}>
                    开始收藏
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 审核状态标签页 */}
        {activeTab === 'pending' && (
          <div className={styles.tabContent}>
            <div className={styles.contentHeader}>
              <h2>我的观鸟记录审核状态</h2>
              <p>查看您提交的观鸟记录的审核进度</p>
            </div>
            <div className={styles.pendingList}>
              {pendingRecords.map((record) => (
                <div key={record._id} className={`${styles.pendingItem} ${styles[record.status]}`}>
                  <div className={styles.sightingHeader}>
                    <h3>{record.title}</h3>
                    <span className={`${styles.statusBadge} ${styles[record.status]}`}>
                      {record.status === 'pending' && '⏳ 待审核'}
                      {record.status === 'approved' && '✅ 已通过'}
                      {record.status === 'rejected' && '❌ 已拒绝'}
                    </span>
                  </div>
                  <div className={styles.sightingDetails}>
                    <p><strong>地点:</strong> {record.location.name}</p>
                    <p><strong>鸟类:</strong> {record.birds.length} 种 - {record.birds.map(b => b.birdId.name).join(', ')}</p>
                    <p><strong>观察时间:</strong> {new Date(record.date).toLocaleString('zh-CN')}</p>
                    {record.notes && <p><strong>备注:</strong> {record.notes}</p>}
                    <p><strong>提交时间:</strong> {new Date(record.createdAt).toLocaleString('zh-CN')}</p>
                    {record.reviewedAt && (
                      <p><strong>审核时间:</strong> {new Date(record.reviewedAt).toLocaleString('zh-CN')}</p>
                    )}
                    {record.reviewNotes && (
                      <p><strong>审核意见:</strong> {record.reviewNotes}</p>
                    )}
                  </div>
                </div>
              ))}
              {pendingRecords.length === 0 && (
                <div className={styles.emptyState}>
                  <p>还没有提交任何观鸟记录</p>
                  <Link href="/sightings/record" className={styles.emptyAction}>
                    开始记录
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
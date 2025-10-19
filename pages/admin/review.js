import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from '../../styles/AdminReview.module.css';

export default function AdminReview() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('newBirds');
  const [newBirdRequests, setNewBirdRequests] = useState([]);
  const [temporarySightings, setTemporarySightings] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [stats, setStats] = useState({
    pendingNewBirds: 0,
    pendingSightings: 0,
    totalReports: 0
  });

  // 检查管理员权限
  useEffect(() => {
    const checkAdminAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      try {
        const response = await fetch('/api/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.data.role === 'admin') {
          setUser(data.data);
        } else {
          alert('只有管理员可以访问此页面');
          router.push('/');
        }
      } catch (error) {
        console.error('权限检查失败:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAdminAuth();
  }, [router]);

  // 加载待审核数据
  useEffect(() => {
    if (user && user.role === 'admin') {
      loadPendingData();
    }
  }, [user]);

  const loadPendingData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // 加载新鸟类申请
      const newBirdsResponse = await fetch('/api/admin/pending-birds', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const newBirdsData = await newBirdsResponse.json();
      if (newBirdsData.success) {
        setNewBirdRequests(newBirdsData.data);
      }

      // 加载临时观察记录
      const sightingsResponse = await fetch('/api/admin/pending-sightings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sightingsData = await sightingsResponse.json();
      if (sightingsData.success) {
        setTemporarySightings(sightingsData.data);
      }

      // 加载用户报告
      const reportsResponse = await fetch('/api/admin/user-reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const reportsData = await reportsResponse.json();
      if (reportsData.success) {
        setUserReports(reportsData.data);
      }

      // 更新统计
      setStats({
        pendingNewBirds: newBirdsData.data?.length || 0,
        pendingSightings: sightingsData.data?.length || 0,
        totalReports: reportsData.data?.length || 0
      });

    } catch (error) {
      console.error('加载待审核数据失败:', error);
    }
  };

  // 审核新鸟类申请
  const reviewNewBird = async (birdId, action, feedback = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/review-bird/${birdId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, feedback })
      });

      const data = await response.json();
      if (data.success) {
        alert(`鸟类申请已${action === 'approve' ? '通过' : '拒绝'}`);
        loadPendingData(); // 重新加载数据
      } else {
        alert('操作失败：' + data.message);
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('操作失败，请重试');
    }
  };

  // 审核临时观察记录
  const reviewSighting = async (sightingId, action, feedback = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/review-sighting/${sightingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, feedback })
      });

      const data = await response.json();
      if (data.success) {
        alert(`观察记录已${action === 'approve' ? '通过' : '拒绝'}`);
        loadPendingData(); // 重新加载数据
      } else {
        alert('操作失败：' + data.message);
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('操作失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className={styles.errorContainer}>
        <h1>访问被拒绝</h1>
        <p>只有管理员可以访问此页面</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>管理员审核 - KBird</title>
        <meta name="description" content="管理员审核页面" />
      </Head>

      <Navbar />
      
      <main className={styles.adminReview}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1>🔍 管理员审核中心</h1>
            <p>管理用户提交的数据和申请</p>
          </header>

          {/* 统计概览 */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>新鸟类申请</h3>
              <div className={styles.statNumber}>{stats.pendingNewBirds}</div>
              <p>待审核</p>
            </div>
            <div className={styles.statCard}>
              <h3>临时观察记录</h3>
              <div className={styles.statNumber}>{stats.pendingSightings}</div>
              <p>待确认</p>
            </div>
            <div className={styles.statCard}>
              <h3>用户报告</h3>
              <div className={styles.statNumber}>{stats.totalReports}</div>
              <p>待处理</p>
            </div>
          </div>

          {/* 标签页导航 */}
          <div className={styles.tabNavigation}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'newBirds' ? styles.active : ''}`}
              onClick={() => setActiveTab('newBirds')}
            >
              新鸟类申请 ({stats.pendingNewBirds})
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'sightings' ? styles.active : ''}`}
              onClick={() => setActiveTab('sightings')}
            >
              临时观察记录 ({stats.pendingSightings})
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'reports' ? styles.active : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              用户报告 ({stats.totalReports})
            </button>
          </div>

          {/* 新鸟类申请 */}
          {activeTab === 'newBirds' && (
            <div className={styles.tabContent}>
              <h2>新鸟类申请</h2>
              {newBirdRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>暂无待审核的新鸟类申请</p>
                </div>
              ) : (
                <div className={styles.requestList}>
                  {newBirdRequests.map((request) => (
                    <div key={request._id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <h3>{request.name}</h3>
                        <span className={styles.requestDate}>
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.requestDetails}>
                        <p><strong>学名:</strong> {request.scientificName}</p>
                        <p><strong>描述:</strong> {request.description}</p>
                        <p><strong>栖息地:</strong> {request.habitat}</p>
                        <p><strong>分布:</strong> {request.distribution}</p>
                        <p><strong>申请人:</strong> {request.requestedBy?.name}</p>
                      </div>
                      <div className={styles.requestActions}>
                        <button 
                          className={styles.approveButton}
                          onClick={() => reviewNewBird(request._id, 'approve')}
                        >
                          ✅ 通过
                        </button>
                        <button 
                          className={styles.rejectButton}
                          onClick={() => {
                            const feedback = prompt('请输入拒绝原因（可选）:');
                            reviewNewBird(request._id, 'reject', feedback);
                          }}
                        >
                          ❌ 拒绝
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 临时观察记录 */}
          {activeTab === 'sightings' && (
            <div className={styles.tabContent}>
              <h2>临时观察记录</h2>
              {temporarySightings.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>暂无待确认的临时观察记录</p>
                </div>
              ) : (
                <div className={styles.requestList}>
                  {temporarySightings.map((sighting) => (
                    <div key={sighting._id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <h3>{sighting.bird.name}</h3>
                        <span className={styles.requestDate}>
                          {new Date(sighting.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.requestDetails}>
                        <p><strong>学名:</strong> {sighting.bird.scientificName}</p>
                        <p><strong>观察地点:</strong> {sighting.location.name}</p>
                        <p><strong>观察者:</strong> {sighting.observer?.name}</p>
                        <p><strong>备注:</strong> {sighting.notes}</p>
                      </div>
                      <div className={styles.requestActions}>
                        <button 
                          className={styles.approveButton}
                          onClick={() => reviewSighting(sighting._id, 'approve')}
                        >
                          ✅ 确认
                        </button>
                        <button 
                          className={styles.rejectButton}
                          onClick={() => {
                            const feedback = prompt('请输入拒绝原因（可选）:');
                            reviewSighting(sighting._id, 'reject', feedback);
                          }}
                        >
                          ❌ 拒绝
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 用户报告 */}
          {activeTab === 'reports' && (
            <div className={styles.tabContent}>
              <h2>用户报告</h2>
              {userReports.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>暂无用户报告</p>
                </div>
              ) : (
                <div className={styles.requestList}>
                  {userReports.map((report) => (
                    <div key={report._id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <h3>{report.title}</h3>
                        <span className={styles.requestDate}>
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.requestDetails}>
                        <p><strong>报告人:</strong> {report.reporter?.name}</p>
                        <p><strong>类型:</strong> {report.type}</p>
                        <p><strong>内容:</strong> {report.content}</p>
                        <p><strong>状态:</strong> {report.status}</p>
                      </div>
                      <div className={styles.requestActions}>
                        <button 
                          className={styles.approveButton}
                          onClick={() => {
                            // 处理报告
                            alert('报告处理功能待实现');
                          }}
                        >
                          ✅ 已处理
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

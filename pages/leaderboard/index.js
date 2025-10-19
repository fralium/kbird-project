import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from '../../styles/Leaderboard.module.css';

export default function Leaderboard() {
  const [birdFirsts, setBirdFirsts] = useState([]);
  const [locationFirsts, setLocationFirsts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bird-firsts');

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        const [birdResponse, locationResponse] = await Promise.all([
          fetch('/api/leaderboard/bird-firsts'),
          fetch('/api/leaderboard/location-firsts')
        ]);

        if (birdResponse.ok) {
          const birdData = await birdResponse.json();
          if (birdData.success) {
            setBirdFirsts(birdData.data);
          }
        }

        if (locationResponse.ok) {
          const locationData = await locationResponse.json();
          if (locationData.success) {
            setLocationFirsts(locationData.data);
          }
        }
      } catch (error) {
        console.error('获取成就榜数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>成就榜 - KBird</title>
        <meta name="description" content="查看鸟类首次记录和地点首次记录的成就榜" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>🏆 成就榜</h1>
          <p className={styles.description}>
            记录每一个重要的首次发现，见证观鸟历史的创造
          </p>
        </div>

        <div className={styles.tabContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'bird-firsts' ? styles.active : ''}`}
            onClick={() => setActiveTab('bird-firsts')}
          >
            🐦 鸟类首次记录榜
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'location-firsts' ? styles.active : ''}`}
            onClick={() => setActiveTab('location-firsts')}
          >
            📍 地点首次记录榜
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>正在加载成就榜数据...</p>
          </div>
        ) : (
          <div className={styles.content}>
            {activeTab === 'bird-firsts' && (
              <div className={styles.leaderboardSection}>
                <h2 className={styles.sectionTitle}>鸟类首次记录榜</h2>
                <p className={styles.sectionDescription}>
                  记录每一种鸟类第一次被记录的时间和地点
                </p>
                
                {birdFirsts.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🐦</div>
                    <h3>暂无鸟类首次记录</h3>
                    <p>成为第一个记录新鸟类的用户吧！</p>
                    <Link href="/birds/add" className={styles.emptyButton}>
                      📝 添加鸟类
                    </Link>
                  </div>
                ) : (
                  <div className={styles.leaderboardList}>
                    {birdFirsts.map((record, index) => (
                      <div key={record._id} className={styles.leaderboardItem}>
                        <div className={styles.rank}>
                          <span className={styles.rankIcon}>{getRankIcon(index)}</span>
                        </div>
                        <div className={styles.birdInfo}>
                          <div className={styles.birdImage}>
                            {record.bird.images && record.bird.images.length > 0 ? (
                              <img 
                                src={record.bird.images[0].url} 
                                alt={record.bird.name}
                                className={styles.image}
                              />
                            ) : (
                              <div className={styles.imagePlaceholder}>
                                {record.bird.name}
                              </div>
                            )}
                          </div>
                          <div className={styles.birdDetails}>
                            <h3 className={styles.birdName}>{record.bird.name}</h3>
                            <p className={styles.scientificName}>{record.bird.scientificName}</p>
                            <div className={styles.recordInfo}>
                              <span className={styles.location}>📍 {record.location}</span>
                              <span className={styles.date}>📅 {formatDate(record.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar}>
                            {record.user.avatar ? (
                              <img src={record.user.avatar.startsWith('/') ? record.user.avatar : `/images/avatars/${record.user.avatar}`} alt={record.user.name} />
                            ) : (
                              <div className={styles.avatarPlaceholder}>
                                {record.user.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className={styles.userDetails}>
                            <span className={styles.userName}>{record.user.name}</span>
                            <span className={styles.userTitle}>首次记录者</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'location-firsts' && (
              <div className={styles.leaderboardSection}>
                <h2 className={styles.sectionTitle}>地点首次记录榜</h2>
                <p className={styles.sectionDescription}>
                  记录每一个新地点第一次被记录的时间和发现者
                </p>
                
                {locationFirsts.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📍</div>
                    <h3>暂无地点首次记录</h3>
                    <p>成为第一个在新地点记录鸟类的用户吧！</p>
                    <Link href="/records" className={styles.emptyButton}>
                      📝 添加观鸟记录
                    </Link>
                  </div>
                ) : (
                  <div className={styles.leaderboardList}>
                    {locationFirsts.map((record, index) => (
                      <div key={record._id} className={styles.leaderboardItem}>
                        <div className={styles.rank}>
                          <span className={styles.rankIcon}>{getRankIcon(index)}</span>
                        </div>
                        <div className={styles.locationInfo}>
                          <div className={styles.locationIcon}>📍</div>
                          <div className={styles.locationDetails}>
                            <h3 className={styles.locationName}>{record.location}</h3>
                            <div className={styles.recordInfo}>
                              <span className={styles.birdCount}>🐦 发现 {record.birdCount} 种鸟类</span>
                              <span className={styles.date}>📅 {formatDate(record.firstRecordDate)}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar}>
                            {record.firstUser.avatar ? (
                              <img src={record.firstUser.avatar.startsWith('/') ? record.firstUser.avatar : `/images/avatars/${record.firstUser.avatar}`} alt={record.firstUser.name} />
                            ) : (
                              <div className={styles.avatarPlaceholder}>
                                {record.firstUser.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className={styles.userDetails}>
                            <span className={styles.userName}>{record.firstUser.name}</span>
                            <span className={styles.userTitle}>地点开拓者</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

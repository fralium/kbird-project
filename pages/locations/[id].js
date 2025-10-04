import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from '../../styles/LocationDetail.module.css';

export default function LocationDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sightings, setSightings] = useState([]);

  useEffect(() => {
    if (!id) return;
    
    fetchLocationDetail();
  }, [id]);

  const fetchLocationDetail = async () => {
    try {
      const response = await fetch(`/api/locations/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLocation(data.data);
          // 获取该地点的观鸟记录
          await fetchLocationSightings(data.data.name);
        } else {
          setError(data.message || '获取地点详情失败');
        }
      } else {
        setError('获取地点详情失败');
      }
    } catch (error) {
      console.error('获取地点详情失败:', error);
      setError('获取地点详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationSightings = async (locationName) => {
    try {
      console.log('开始获取地点观鸟记录:', locationName);
      
      // 使用Record数据而不是sightings数据
      const response = await fetch(`/api/records?location=${encodeURIComponent(locationName)}&status=approved,pending`);
      console.log('API响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API响应数据:', data);
        
        if (data.success) {
          console.log('获取到的观鸟记录数据:', data.data);
          console.log('记录数量:', data.data.length);
          
          // 将Record数据转换为sightings格式以保持兼容性
          const convertedSightings = [];
          data.data.forEach(record => {
            console.log('处理记录:', record._id, '包含鸟类数量:', record.birds.length);
            record.birds.forEach(bird => {
              const sighting = {
                _id: `${record._id}_${bird.birdId._id}`,
                bird: {
                  _id: bird.birdId._id,
                  name: bird.birdId.name,
                  scientificName: bird.birdId.scientificName,
                  images: bird.birdId.images || []
                },
                location: {
                  name: record.location.name,
                  _id: record.location._id
                },
                date: record.date,
                observer: {
                  name: record.observer.name,
                  _id: record.observer._id
                },
                notes: bird.notes || '',
                images: bird.images || []
              };
              convertedSightings.push(sighting);
              console.log('添加sighting:', sighting.bird.name);
            });
          });
          
          console.log('转换后的sightings总数:', convertedSightings.length);
          console.log('设置sightings状态...');
          setSightings(convertedSightings);
        } else {
          console.log('API返回失败:', data.message);
        }
      } else {
        console.log('API请求失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('获取观鸟记录失败:', error);
    }
  };

  // 按日期分组观察记录
  const groupSightingsByDate = (sightings) => {
    const grouped = {};
    sightings.forEach(sighting => {
      const date = new Date(sighting.date).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(sighting);
    });
    return grouped;
  };

  // 格式化日期显示
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>加载中... - KBird</title>
        </Head>
        <Navbar />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>正在加载地点详情...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className={styles.container}>
        <Head>
          <title>地点不存在 - KBird</title>
        </Head>
        <Navbar />
        <div className={styles.error}>
          <h1>地点不存在</h1>
          <p>{error || '该地点不存在或已被删除'}</p>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点列表
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const groupedSightings = groupSightingsByDate(sightings);
  const sortedDates = Object.keys(groupedSightings).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className={styles.container}>
      <Head>
        <title>{location.name} - 地点详情 - KBird</title>
      </Head>
      <Navbar />
      
      <div className={styles.content}>
        {/* 地点标题 */}
        <div className={styles.locationHeader}>
          <h1 className={styles.locationName}>{location.name}</h1>
          <div className={styles.locationInfo}>
            <span className={styles.locationType}>{location.type || '地点'}</span>
            <span className={styles.locationAddress}>
              {location.address?.province} • {location.address?.city}
            </span>
          </div>
        </div>

        {/* 地点描述 */}
        {location.description && (
          <div className={styles.description}>
            <p>{location.description}</p>
          </div>
        )}

        {/* 统计数据 */}
        <div className={styles.statsSection}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📊</div>
              <div className={styles.statNumber}>
                {(() => {
                  // 按观察批次统计（同一天同一地点的观察算作一个批次）
                  const observationBatches = new Map();
                  sightings.forEach(sighting => {
                    const batchKey = `${sighting.location.name}_${new Date(sighting.date).toDateString()}`;
                    if (!observationBatches.has(batchKey)) {
                      observationBatches.set(batchKey, {
                        location: sighting.location.name,
                        date: sighting.date,
                        species: new Set()
                      });
                    }
                    observationBatches.get(batchKey).species.add(sighting.bird._id.toString());
                  });
                  return observationBatches.size;
                })()}
              </div>
              <div className={styles.statLabel}>观察次数</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z"/>
                </svg>
              </div>
              <div className={styles.statNumber}>
                {new Set(sightings.map(s => s.bird._id)).size}
              </div>
              <div className={styles.statLabel}>鸟类种类</div>
            </div>
          </div>

        {/* 观鸟记录时间线 */}
        <div className={styles.sightingsSection}>
          <h2>观鸟记录</h2>
          {sightings.length > 0 ? (
            <div className={styles.timeline}>
              {sortedDates.map((date, index) => (
                <div key={date} className={styles.timelineItem}>
                  <div className={styles.timelineDate}>
                    <div className={styles.dateContent}>
                      <span className={styles.dateText}>{formatDate(date)}</span>
                      <span className={styles.dateSubtext}>
                        {groupedSightings[date].length} 种鸟类
                      </span>
                    </div>
                  </div>
                  
                  <div className={styles.timelineContent}>
                    <div className={styles.birdsGrid}>
                      {groupedSightings[date].map((sighting, sightingIndex) => (
                        <div key={sighting._id} className={styles.birdCard}>
                          <Link href={`/birds/${sighting.bird._id}`} className={styles.birdLink}>
                            <div className={styles.birdImage}>
                              {(() => {
                                // 处理images数组，支持字符串和对象格式
                                const images = sighting.bird.images;
                                if (images && Array.isArray(images) && images.length > 0) {
                                  let imageUrl = images[0];
                                  // 如果是对象，尝试获取url属性
                                  if (typeof imageUrl === 'object' && imageUrl !== null) {
                                    imageUrl = imageUrl.url || imageUrl.path || imageUrl.src || imageUrl;
                                  }
                                  // 确保是字符串
                                  if (typeof imageUrl === 'string' && imageUrl.trim()) {
                                    return (
                                      <img
                                        src={imageUrl}
                                        alt={sighting.bird.name}
                                        loading="lazy"
                                        onError={(e) => {
                                          console.log('图片加载失败:', sighting.bird.name, imageUrl);
                                          e.target.style.display = 'none';
                                          e.target.nextElementSibling.style.display = 'flex';
                                        }}
                                        onLoad={() => {
                                          console.log('图片加载成功:', sighting.bird.name, imageUrl);
                                        }}
                                      />
                                    );
                                  }
                                }
                                return null;
                              })()}
                              <div 
                                className={styles.birdPlaceholder}
                                style={{ 
                                  display: (() => {
                                    const images = sighting.bird.images;
                                    if (images && Array.isArray(images) && images.length > 0) {
                                      let imageUrl = images[0];
                                      if (typeof imageUrl === 'object' && imageUrl !== null) {
                                        imageUrl = imageUrl.url || imageUrl.path || imageUrl.src || imageUrl;
                                      }
                                      return (typeof imageUrl === 'string' && imageUrl.trim()) ? 'none' : 'flex';
                                    }
                                    return 'flex';
                                  })()
                                }}
                              >
                                🐦
                              </div>
                            </div>
                            <div className={styles.birdInfo}>
                              <h3 className={styles.birdName}>{sighting.bird.name}</h3>
                              <p className={styles.birdScientific}>{sighting.bird.scientificName}</p>
                              {sighting.observer && (
                                <p className={styles.observer}>观察者: {sighting.observer.name}</p>
                              )}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noSightings}>
              <p>该地点暂无观鸟记录</p>
              <Link href="/records/add" className={styles.addSightingButton}>
                添加观鸟记录
              </Link>
            </div>
          )}
        </div>

        {/* 返回按钮 */}
        <div className={styles.backSection}>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点列表
          </Link>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
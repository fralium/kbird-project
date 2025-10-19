import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ErrorMessage from '../components/ErrorMessage';
import { formatCategory } from '../utils/formatCategory';
import { BirdIcon, AddIcon, TrophyIcon, MapIcon, CameraIcon, LocationIcon, SearchIcon, UserIcon, colors } from '../components/Icons';
import { api } from '../utils/api';
import { useErrorHandler } from '../utils/useErrorHandler';

// 动态背景粒子组件
const ParticleBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 创建粒子
    const createParticles = () => {
      particlesRef.current = [];
      const particleCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 10000));
      
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2,
          color: `hsl(${Math.random() * 60 + 120}, 70%, 60%)`
        });
      }
    };

    createParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particlesRef.current.forEach(particle => {
        // 更新位置
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // 边界检查
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
        
        // 绘制粒子
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.fill();
      });
      
      // 绘制连线
      particlesRef.current.forEach((particle, i) => {
        particlesRef.current.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particleCanvas} />;
};

// 数字滚动动画组件
const AnimatedNumber = ({ value, duration = 2000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  // 当value变化时重新启动动画
  useEffect(() => {
    if (value > 0) {
      setDisplayValue(0); // 重置显示值
      setIsVisible(false); // 重置可见状态
      // 延迟一点时间后重新开始动画
      setTimeout(() => {
        setIsVisible(true);
        animateNumber();
      }, 100);
    }
  }, [value]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          animateNumber();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible, value]); // 添加value依赖

  const animateNumber = () => {
    const startTime = Date.now();
    const startValue = 0;
    const endValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutCubic);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  return <span ref={ref} className={styles.animatedNumber}>{displayValue.toLocaleString()}</span>;
};

// 3D卡片组件
const BirdCard3D = ({ bird, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const randomImage = bird.images && bird.images.length > 0 
    ? bird.images[Math.floor(Math.random() * bird.images.length)]
    : null;

  return (
    <Link 
      key={bird._id} 
      href={`/birds/${bird._id}`} 
      className={`${styles.birdCard3D} ${isHovered ? styles.hovered : ''}`}
      style={{ '--delay': `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={cardRef}
    >
      <div className={styles.cardInner}>
        <div className={styles.cardFront}>
          <div className={styles.imageContainer}>
            {randomImage ? (
              <img 
                src={randomImage.url} 
                alt={bird.name}
                className={styles.cardImage}
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div 
              className={styles.cardImagePlaceholder}
              style={{ display: randomImage ? 'none' : 'flex' }}
            >
              <div className={styles.placeholderText}>{bird.name}</div>
            </div>
          </div>
          <div className={styles.cardContent}>
            <h3 className={styles.cardTitle}>{bird.name}</h3>
            <p className={styles.cardScientific}>{bird.scientificName}</p>
            <div className={styles.protectionStatus}>
              {bird.iucnProtectionLevel && (
                <span className={`${styles.statusBadge} ${styles.iucn}`}>
                  IUCN: {bird.iucnProtectionLevel}
                </span>
              )}
              {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' && (
                <span className={`${styles.statusBadge} ${styles.china}`}>
                  中国: {bird.chinaProtectionLevel}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.cardBack}>
          <div className={styles.cardBackContent}>
            <h4>详细信息</h4>
            <p className={styles.cardDescription}>
              {bird.description || '暂无详细描述'}
            </p>
            <div className={styles.cardTags}>
              {bird.tags && bird.tags.slice(0, 3).map((tag, tagIndex) => (
                <span key={tagIndex} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default function Home() {
  const [featuredBirds, setFeaturedBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedRef = useRef(false); // 使用ref防止重复请求
  const [stats, setStats] = useState({
    totalBirds: 0,
    totalSightings: 0,
    totalUsers: 0,
    totalLocations: 0
  });
  const { errors, addError, removeError } = useErrorHandler();

  // 重置fetch状态，确保每次组件挂载都能获取数据
  useEffect(() => {
    hasFetchedRef.current = false;
  }, []);


  useEffect(() => {
    const fetchData = async () => {
      // 防止重复请求
      if (hasFetchedRef.current) return;
      
      try {
        setLoading(true);
        hasFetchedRef.current = true;
        
        // 并行获取所有数据
        const [birdsData, recordsData, locationsData] = await Promise.all([
          api.birds.getAll({ limit: 50 }), // 获取更多鸟类用于随机选择
          api.records.getAll(),
          api.locations.getAll()
        ]);

        // 设置精选鸟类 - 随机选择6个
        if (birdsData && birdsData.success && birdsData.data && birdsData.data.length > 0) {
          // 使用 Fisher-Yates 洗牌算法进行更好的随机打乱
          const shuffledBirds = [...birdsData.data];
          for (let i = shuffledBirds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledBirds[i], shuffledBirds[j]] = [shuffledBirds[j], shuffledBirds[i]];
          }
          const randomBirds = shuffledBirds.slice(0, 6);
          setFeaturedBirds(randomBirds);
        } else {
          console.error('获取精选鸟类失败:', birdsData);
        }

        // 设置统计数据
        const newStats = {
          totalBirds: 0,
          totalSightings: 0,
          totalUsers: 0,
          totalLocations: 0
        };

        if (birdsData.success) {
          newStats.totalBirds = birdsData.total || birdsData.count || birdsData.data.length;
        }

        if (recordsData.success) {
          newStats.totalSightings = recordsData.total || recordsData.count || recordsData.data.length;
        }

        if (locationsData.success) {
          newStats.totalLocations = locationsData.total || locationsData.pagination?.totalItems || locationsData.data.length;
        }

        setStats(newStats);
      } catch (error) {
        console.error('获取数据失败:', error);
        addError('获取数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 刷新精选鸟类
  const refreshFeaturedBirds = async () => {
    try {
      setRefreshing(true);
      const birdsData = await api.birds.getAll({ limit: 50 });
      
      if (birdsData.success && birdsData.data.length > 0) {
        // 使用 Fisher-Yates 洗牌算法进行更好的随机打乱
        const shuffledBirds = [...birdsData.data];
        for (let i = shuffledBirds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledBirds[i], shuffledBirds[j]] = [shuffledBirds[j], shuffledBirds[i]];
        }
        const randomBirds = shuffledBirds.slice(0, 6);
        setFeaturedBirds(randomBirds);
      }
    } catch (error) {
      console.error('刷新精选鸟类失败:', error);
      addError('刷新精选鸟类失败，请重试');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>KBird - 鸟类收集整理网站</title>
        <meta name="description" content="记录鸟类信息、上传照片、分享发现" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />
      
      {/* 错误消息显示 */}
      {errors.map(error => (
        <ErrorMessage
          key={error.id}
          error={error.message}
          type={error.type}
          onClose={() => removeError(error.id)}
        />
      ))}
      
      <main className={styles.main}>
        {/* 动态粒子背景 */}
        <ParticleBackground />
        
        {/* 英雄区域 */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                <span className={styles.titleLine1}>探索</span>
                <span className={styles.titleLine2}>
                  <span className={styles.highlight}>鸟类</span>的
                </span>
                <span className={styles.titleLine3}>奇妙世界</span>
              </h1>
              <p className={styles.heroDescription}>
                记录、分享、发现 - 让每一次观鸟都成为珍贵的回忆
              </p>
              <div className={styles.heroButtons}>
                <Link href="/birds" className={styles.primaryButton}>
                  <BirdIcon size={20} color="white" />
                  开始探索
                </Link>
                <Link href="/register" className={styles.secondaryButton}>
                  加入社区
                </Link>
              </div>
            </div>
            
            <div className={styles.heroStats}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>鸟类种类</div>
                <div className={styles.statNumber}>
                  <AnimatedNumber value={stats.totalBirds} />
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>观察记录</div>
                <div className={styles.statNumber}>
                  <AnimatedNumber value={stats.totalSightings} />
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>观鸟地点</div>
                <div className={styles.statNumber}>
                  <AnimatedNumber value={stats.totalLocations} />
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.heroScroll}>
            <div className={styles.scrollIndicator}>
              <div className={styles.scrollText}>向下滚动</div>
              <div className={styles.scrollArrow}>↓</div>
            </div>
          </div>
        </section>

        {/* 精选鸟类区域 */}
        <section className={styles.featuredSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleContainer}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.titleIcon}>✨</span>
                精选鸟类
              </h2>
              <p className={styles.sectionDescription}>
                每次刷新都会发现不同的精彩鸟类，探索它们的独特魅力
              </p>
            </div>
            <div className={styles.sectionActions}>
              <button 
                onClick={refreshFeaturedBirds} 
                disabled={refreshing}
                className={styles.refreshButton}
              >
                <span className={styles.refreshIcon}>
                  {refreshing ? '⟳' : '🎲'}
                </span>
                {refreshing ? '刷新中...' : '刷新精选'}
              </button>
              <Link href="/birds" className={styles.viewAllButton}>
                查看全部
                <span className={styles.arrowIcon}>→</span>
              </Link>
            </div>
          </div>
          
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}>
                <div className={styles.spinnerRing}></div>
                <div className={styles.spinnerRing}></div>
                <div className={styles.spinnerRing}></div>
              </div>
              <p>正在加载精选鸟类...</p>
            </div>
          ) : (
            <div className={styles.birdGrid3D}>
              {featuredBirds.map((bird, index) => (
                <BirdCard3D key={bird._id} bird={bird} index={index} />
              ))}
            </div>
          )}
        </section>


        {/* 功能展示区域 */}
        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleContainer}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.titleIcon}>🚀</span>
                强大功能
              </h2>
              <p className={styles.sectionDescription}>
                探索KBird的强大功能，让观鸟变得更加有趣和专业
              </p>
            </div>
          </div>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <AddIcon size={32} color={colors.success} />
              </div>
              <h3>智能记录</h3>
              <p>详细记录鸟类的学名、特征、栖息地等信息，建立完整的鸟类数据库</p>
              <Link href="/records/add" className={styles.featureLink}>
                开始记录
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <CameraIcon size={32} color={colors.info} />
              </div>
              <h3>照片分享</h3>
              <p>分享您拍摄的精美鸟类照片，与社区成员共同欣赏和学习</p>
              <Link href="/records/add" className={styles.featureLink}>
                上传照片
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <LocationIcon size={32} color={colors.primary} />
              </div>
              <h3>地点名录</h3>
              <p>浏览和管理观鸟地点，帮助其他观鸟爱好者找到最佳观鸟地点</p>
              <Link href="/records" className={styles.featureLink}>
                查看记录
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <SearchIcon size={32} color={colors.warning} />
              </div>
              <h3>智能搜索</h3>
              <p>快速查找您感兴趣的鸟类信息，支持多种搜索方式和筛选条件</p>
              <Link href="/records/add" className={styles.featureLink}>
                开始搜索
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <TrophyIcon size={32} color={colors.accent} />
              </div>
              <h3>成就系统</h3>
              <p>记录每一个重要的首次发现，见证观鸟路上的每一个里程碑</p>
              <Link href="/leaderboard" className={styles.featureLink}>
                查看成就
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <UserIcon size={32} color={colors.secondary} />
              </div>
              <h3>社区互动</h3>
              <p>与其他鸟类爱好者交流分享，建立专业的观鸟社区</p>
              <Link href="/register" className={styles.featureLink}>
                加入社区
                <span className={styles.linkArrow}>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 行动号召区域 */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaBackground}>
            <div className={styles.ctaContent}>
              <div className={styles.ctaText}>
                <h2 className={styles.ctaTitle}>
                  准备开始您的
                  <span className={styles.ctaHighlight}>观鸟之旅</span>？
                </h2>
                <p className={styles.ctaDescription}>
                  加入我们的专业社区，分享您的观鸟发现，探索鸟类的奇妙世界
                </p>
                <div className={styles.ctaButtons}>
                  <Link href="/register" className={styles.ctaPrimaryButton}>
                    <span className={styles.buttonIcon}>🚀</span>
                    立即注册
                  </Link>
                  <Link href="/birds" className={styles.ctaSecondaryButton}>
                    <span className={styles.buttonIcon}></span>
                    浏览鸟类
                  </Link>
                </div>
              </div>
              <div className={styles.ctaVisual}>
                <div className={styles.floatingElement}>
                  <div className={styles.birdIcon}>🦅</div>
                  <div className={styles.floatingText}>探索</div>
                </div>
                <div className={styles.floatingElement}>
                  <div className={styles.cameraIcon}></div>
                  <div className={styles.floatingText}>记录</div>
                </div>
                <div className={styles.floatingElement}>
                  <div className={styles.shareIcon}>🤝</div>
                  <div className={styles.floatingText}>分享</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
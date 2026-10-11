'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '@/styles/Home.module.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ErrorMessage from '@/components/ErrorMessage';
import SkeletonCard from '@/components/SkeletonCard';
import KeyboardNavigation from '@/components/KeyboardNavigation';
import PageState from '@/components/PageState';
import { api } from '@/utils/api';
import { useErrorHandler } from '@/utils/useErrorHandler';
import { HOME_HERO_BACKGROUNDS, pickRandomHeroBackground } from '@/data/homeHeroBackgrounds';

const AnimatedNumber = ({ value, duration = 2000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value > 0) {
      setDisplayValue(0);
      setIsVisible(false);
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
  }, [isVisible, value]);

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

  return (
    <span ref={ref} className={styles.animatedNumber}>
      {displayValue.toLocaleString()}
    </span>
  );
};

const BirdCard3D = ({ bird, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const randomImage = useMemo(() => {
    if (!bird.images || bird.images.length === 0) return null;
    const stableSeed = String(bird._id || bird.name || 'bird');
    let hash = 0;
    for (let i = 0; i < stableSeed.length; i += 1) {
      hash = (hash << 5) - hash + stableSeed.charCodeAt(i);
      hash |= 0;
    }
    const indexFromHash = Math.abs(hash) % bird.images.length;
    return bird.images[indexFromHash];
  }, [bird._id, bird.images, bird.name]);
  const imageUrl = randomImage?.url ?? (typeof randomImage === 'string' ? randomImage : null);
  const hasImage = !!imageUrl;
  const shouldOptimizeImage = typeof imageUrl === 'string' && imageUrl.startsWith('/');

  return (
    <Link
      key={bird._id}
      href={`/birds/${bird._id}`}
      className={`${styles.birdCard3D} ${isHovered ? styles.hovered : ''}`}
      style={{ '--delay': `${index * 80}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={cardRef}
    >
      <div className={styles.cardInner}>
        <div className={styles.cardImageWrap}>
          {hasImage ? (
            <Image
              src={imageUrl}
              alt={bird.name}
              width={420}
              height={280}
              unoptimized={!shouldOptimizeImage}
              className={styles.cardImage}
              onError={(e) => {
                e.target.style.display = 'none';
                const ph = e.target.nextElementSibling;
                if (ph) ph.classList.add(styles.placeholderVisible);
              }}
            />
          ) : null}
          <div className={`${styles.cardPlaceholder} ${!hasImage ? styles.placeholderVisible : ''}`}>
            <span className={styles.placeholderChar}>{bird.name?.charAt(0) || '?'}</span>
          </div>
        </div>
        <div className={styles.cardOverlay}>
          <h3 className={styles.cardTitle}>{bird.name}</h3>
          <p className={styles.cardScientific} data-scientific>
            {bird.scientificName}
          </p>
        </div>
        <div className={styles.cardBadges}>
          {bird.iucnProtectionLevel && (
            <span className={`${styles.statusBadge} ${styles.iucn}`}>{bird.iucnProtectionLevel}</span>
          )}
          {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' && (
            <span className={`${styles.statusBadge} ${styles.china}`}>{bird.chinaProtectionLevel}</span>
          )}
        </div>
      </div>
    </Link>
  );
};

function pickRandomBirds(list, count) {
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export default function HomePageClient({ backgrounds = [] }) {
  const router = useRouter();
  const heroPool = backgrounds.length ? backgrounds : HOME_HERO_BACKGROUNDS;
  const [featuredBirds, setFeaturedBirds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);
  const [heroBackground, setHeroBackground] = useState(heroPool[0]);
  const [heroFadeFrom, setHeroFadeFrom] = useState(null);
  const swappingRef = useRef(false);
  const [stats, setStats] = useState({
    totalBirds: 0,
    totalSightings: 0,
    totalLocations: 0,
  });
  const { errors, addError, removeError } = useErrorHandler();

  useEffect(() => {
    let lastId = '';
    try {
      lastId = sessionStorage.getItem('kbird-hero-bg-id') || '';
    } catch {
      // ignore
    }
    const next = pickRandomHeroBackground(lastId, heroPool);
    setHeroBackground(next);
    try {
      sessionStorage.setItem('kbird-hero-bg-id', next.id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    hasFetchedRef.current = false;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (hasFetchedRef.current) return;

      try {
        setLoading(true);
        hasFetchedRef.current = true;

        const [birdsData, recordsData, locationsSummary] = await Promise.all([
          api.birds.getAll({ limit: 30, hasRecordsOnly: 'true' }),
          api.records.getAll({ limit: 1 }),
          api.locations.getSummary(),
        ]);

        if (birdsData?.success && Array.isArray(birdsData.data) && birdsData.data.length > 0) {
          setFeaturedBirds(pickRandomBirds(birdsData.data, 6));
        }

        setStats({
          totalBirds: birdsData?.success
            ? Number(birdsData.total || birdsData.count || birdsData.data?.length || 0)
            : 0,
          totalSightings: recordsData?.success
            ? Number(
                recordsData.total ||
                  recordsData.pagination?.totalItems ||
                  recordsData.count ||
                  0
              )
            : 0,
          totalLocations: locationsSummary?.success
            ? Number(locationsSummary.data?.total || 0)
            : 0,
        });
      } catch (error) {
        const isConnectionRefused =
          (error?.message || '').includes('Failed to fetch') ||
          (error?.message || '').includes('NetworkError');
        addError(
          isConnectionRefused
            ? '无法连接服务端（端口 13082）。请确认已启动后端：在项目目录运行 npm run server 或同时启动前后端。'
            : '获取数据失败，请刷新页面重试',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const showNextHero = () => {
    if (swappingRef.current || heroPool.length < 2) return;
    const next = pickRandomHeroBackground(heroBackground.id, heroPool);
    if (!next || next.id === heroBackground.id) return;
    swappingRef.current = true;
    const commit = () => {
      setHeroFadeFrom(heroBackground.src);
      setHeroBackground(next);
      swappingRef.current = false;
      try {
        sessionStorage.setItem('kbird-hero-bg-id', next.id);
      } catch {
        // ignore
      }
    };
    const img = new window.Image();
    img.onload = commit;
    img.onerror = commit;
    img.src = next.src;
  };

  const onHeroClick = (event) => {
    if (event.target.closest('a, button')) return;
    showNextHero();
  };

  const refreshFeaturedBirds = async () => {
    try {
      setRefreshing(true);
      const birdsData = await api.birds.getAll({ limit: 30, hasRecordsOnly: 'true' });

      if (birdsData.success && birdsData.data.length > 0) {
        setFeaturedBirds(pickRandomBirds(birdsData.data, 6));
      }
    } catch {
      addError('刷新精选鸟类失败，请重试');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={styles.container}
      style={{
        ['--hero-bg-image']: `url('${heroBackground.src}')`,
      }}
    >
      <Navbar />

      {errors.map((error) => (
        <ErrorMessage
          key={error.id}
          error={error.message}
          type={error.type}
          onClose={() => removeError(error.id)}
        />
      ))}

      <main className={styles.main}>
        <div className={styles.homeFirstScreen}>
          <section
            className={styles.heroSection}
            aria-label={heroBackground.label ? `首页背景：${heroBackground.label}` : '首页背景'}
            onClick={onHeroClick}
          >
            <div className={styles.heroStage} aria-hidden="true">
              {heroFadeFrom ? (
                <div
                  className={styles.heroPhotoBase}
                  style={{ backgroundImage: `url('${heroFadeFrom}')` }}
                />
              ) : null}
              <div
                key={heroBackground.id}
                className={styles.heroPhoto}
                style={{ backgroundImage: `url('${heroBackground.src}')` }}
              />
            </div>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                把野外的遇见，
                <br />
                收进自己的记录
              </h1>
              <div className={styles.heroButtons}>
                  <Link href="/records/quick" className={styles.primaryButton}>
                    快速记录
                  </Link>
                <Link href="/birds?view=place" className={styles.secondaryButton}>
                  已见鸟种
                </Link>
                </div>
              </div>
            </div>
            {heroPool.length > 1 ? (
              <button type="button" className={styles.heroSwap} onClick={showNextHero}>
                换一张
              </button>
            ) : null}
          </section>

          <section className={styles.statsStrip} aria-label="本机数据概览">
            <Link href="/personal/stats" className={styles.statsStripInner}>
              <div className={`${styles.statsStripItem} ${styles.statsStripItemPrimary}`}>
                <span className={styles.statsStripValue}>
                  <AnimatedNumber value={stats.totalBirds} />
                </span>
                <span className={styles.statsStripLabel}>已记录鸟种</span>
              </div>
              <div className={styles.statsStripDivider} aria-hidden="true" />
              <div className={`${styles.statsStripItem} ${styles.statsStripItemPrimary}`}>
                <span className={styles.statsStripValue}>
                  <AnimatedNumber value={stats.totalSightings} />
                </span>
                <span className={styles.statsStripLabel}>观察记录</span>
              </div>
              <div className={styles.statsStripDivider} aria-hidden="true" />
              <div className={`${styles.statsStripItem} ${styles.statsStripItemPrimary}`}>
                <span className={styles.statsStripValue}>
                  <AnimatedNumber value={stats.totalLocations} />
                </span>
                <span className={styles.statsStripLabel}>观鸟地点</span>
              </div>
            </Link>
          </section>
        </div>

        <section className={styles.featuredSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleContainer}>
              <h2 className={styles.sectionTitle}>精选鸟种</h2>
            </div>
            <div className={styles.sectionActions}>
              <button
                type="button"
                onClick={refreshFeaturedBirds}
                disabled={refreshing}
                className={styles.refreshButton}
              >
                {refreshing ? '刷新中…' : '换一批'}
              </button>
              <Link href="/birds" className={styles.viewAllButton}>
                查看全部
              </Link>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <SkeletonCard type="bird" count={6} />
            </div>
          ) : featuredBirds.length === 0 ? (
            <PageState
              type="empty"
              title="还没有可展示的鸟种"
              message="先记一笔观察，或从数据管理导入记录，首页精选就会亮起来。"
              actionLabel="快速记录"
              onAction={() => router.push('/records/quick')}
            />
          ) : (
            <KeyboardNavigation
              items={featuredBirds}
              onNavigate={(index, bird) => {
                router.push(`/birds/${bird._id}`);
              }}
            >
              <div className={styles.birdGrid3D}>
                {featuredBirds.map((bird, index) => (
                  <BirdCard3D key={bird._id} bird={bird} index={index} />
                ))}
              </div>
            </KeyboardNavigation>
          )}
        </section>

        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleContainer}>
              <h2 className={styles.sectionTitle}>常用入口</h2>
            </div>
          </div>

          <div className={styles.featureGrid}>
            <Link href="/records/quick" className={styles.featureCard}>
              <span className={styles.featureAction}>记一笔</span>
              <h3>快速记录</h3>
              <p>一笔记下今天的遇见</p>
              <span className={styles.featureLink} aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/personal/stats" className={styles.featureCard}>
              <span className={styles.featureValue}>
                {loading ? '—' : stats.totalBirds.toLocaleString()}
              </span>
              <h3>个人统计</h3>
              <p>
                {loading
                  ? '加载中…'
                  : `${stats.totalSightings.toLocaleString()} 条观察记录`}
              </p>
              <span className={styles.featureLink} aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/locations" className={styles.featureCard}>
              <span className={styles.featureValue}>
                {loading ? '—' : stats.totalLocations.toLocaleString()}
              </span>
              <h3>地点词典</h3>
              <p>整理过的观鸟地点</p>
              <span className={styles.featureLink} aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/personal/manage?tab=backup" className={styles.featureCard}>
              <span className={styles.featureAction}>备份</span>
              <h3>导入与备份</h3>
              <p>数据进出，安心保存</p>
              <span className={styles.featureLink} aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

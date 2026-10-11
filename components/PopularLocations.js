import { useState, useEffect } from 'react';
import styles from '@/styles/PopularLocations.module.css';
import { api } from '@/utils/api';
import { formatDisplayDate } from '@/utils/localDate';

const PopularLocations = ({ onLocationSelect, selectedLocation }) => {
  const [popularLocations, setPopularLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchPopularLocations();
  }, []);

  const fetchPopularLocations = async () => {
    try {
      setLoading(true);
      const data = await api.locations.getPopular(8);
      
      if (data.success) {
        setPopularLocations(data.data || []);
      }
    } catch (error) {
      console.error('获取热门地点失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (location) => {
    onLocationSelect(location);
  };

  const displayedLocations = showAll ? popularLocations : popularLocations.slice(0, 6);

  if (loading) {
    return (
      <div className={styles.popularLocations}>
        <h3 className={styles.title}>常用地点</h3>
        <div className={styles.loadingContainer}>
          <div className={styles.skeletonItem}></div>
          <div className={styles.skeletonItem}></div>
          <div className={styles.skeletonItem}></div>
        </div>
      </div>
    );
  }

  if (popularLocations.length === 0) {
    return null;
  }

  return (
    <div className={styles.popularLocations}>
      <h3 className={styles.title}>
        常用地点
        <span className={styles.subtitle}>点击快速选择</span>
      </h3>
      
      <div className={styles.locationsGrid}>
        {displayedLocations.map((location, index) => (
          <button
            key={location._id || index}
            className={`${styles.locationCard} ${
              selectedLocation?.name === location.name ? styles.selected : ''
            }`}
            onClick={() => handleLocationClick(location)}
            type="button"
          >
            <div className={styles.locationIcon}>
              📍
            </div>
            <div className={styles.locationInfo}>
              <div className={styles.locationName}>
                {location.name}
              </div>
              <div className={styles.locationStats}>
                <span className={styles.recordCount}>
                  {location.recordCount || 0} 条记录
                </span>
                {location.lastRecordDate && (
                  <span className={styles.lastRecord}>
                    最近: {formatDisplayDate(location.lastRecordDate, 'monthDay')}
                  </span>
                )}
              </div>
            </div>
            {location.isNew && (
              <div className={styles.newBadge}>新</div>
            )}
          </button>
        ))}
      </div>

      {popularLocations.length > 6 && (
        <button
          className={styles.toggleButton}
          onClick={() => setShowAll(!showAll)}
          type="button"
        >
          {showAll ? '收起' : `查看更多 (${popularLocations.length - 6})`}
        </button>
      )}
    </div>
  );
};

export default PopularLocations;


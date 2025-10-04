import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/ImageViewer.module.css';

const ImageViewer = ({ images, currentIndex, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  const goToPrevious = useCallback(() => {
    setActiveIndex(prev => 
      prev > 0 ? prev - 1 : images.length - 1
    );
  }, [images.length]);

  const goToNext = useCallback(() => {
    setActiveIndex(prev => 
      prev < images.length - 1 ? prev + 1 : 0
    );
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // 防止背景滚动

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, goToPrevious, goToNext]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!images || images.length === 0) return null;

  const currentImage = images[activeIndex];
  
  // 处理图片数据格式：可能是字符串URL或包含url属性的对象
  const getImageUrl = (image) => {
    if (typeof image === 'string') {
      return image;
    }
    return image.url || image;
  };
  
  const getImageCaption = (image) => {
    if (typeof image === 'string') {
      return '鸟类图片';
    }
    return image.caption || '鸟类图片';
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.container}>
        {/* 关闭按钮 */}
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        {/* 图片信息 */}
        <div className={styles.imageInfo}>
          <h3 className={styles.imageTitle}>
            {getImageCaption(currentImage)}
          </h3>
          <p className={styles.imageMeta}>
            {currentImage.location && `📍 ${currentImage.location}`}
            {currentImage.date && ` • ${new Date(currentImage.date).toLocaleDateString()}`}
          </p>
        </div>

        {/* 主图片 */}
        <div className={styles.imageContainer}>
          <img
            src={(() => {
              const imageUrl = getImageUrl(currentImage);
              return imageUrl.startsWith('http') ? imageUrl : (typeof window !== 'undefined' ? `${window.location.origin}${imageUrl}` : imageUrl);
            })()}
            alt={getImageCaption(currentImage)}
            className={styles.mainImage}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
          <div className={styles.imageError} style={{ display: 'none' }}>
            <span>图片加载失败</span>
          </div>
        </div>

        {/* 导航按钮 */}
        {images.length > 1 && (
          <>
            <button 
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={goToPrevious}
              aria-label="上一张图片"
            >
              ‹
            </button>
            <button 
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={goToNext}
              aria-label="下一张图片"
            >
              ›
            </button>
          </>
        )}

        {/* 缩略图导航 */}
        {images.length > 1 && (
          <div className={styles.thumbnailContainer}>
            {images.map((image, index) => (
              <button
                key={index}
                className={`${styles.thumbnail} ${index === activeIndex ? styles.active : ''}`}
                onClick={() => setActiveIndex(index)}
              >
                <img
                  src={image.url.startsWith('http') ? image.url : (typeof window !== 'undefined' ? `${window.location.origin}${image.url}` : image.url)}
                  alt={`缩略图 ${index + 1}`}
                  className={styles.thumbnailImage}
                />
              </button>
            ))}
          </div>
        )}

        {/* 图片计数器 */}
        {images.length > 1 && (
          <div className={styles.counter}>
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from '../styles/ImageViewer.module.css';

const ImageViewer = ({ images, currentIndex, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  useEffect(() => {
    if (!images || images.length === 0) return;
    const nextIndex = Number.isFinite(currentIndex) ? currentIndex : 0;
    const clamped = Math.min(Math.max(nextIndex, 0), images.length - 1);
    setActiveIndex(clamped);
  }, [currentIndex, images]);

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

  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), images.length - 1);
  const currentImage = images[safeActiveIndex] || images[0];
  
  // 处理图片数据格式：可能是字符串URL或包含url属性的对象
  const getImageUrl = (image) => {
    if (!image) return '';
    if (typeof image === 'string') {
      return image;
    }
    return image.url || '';
  };
  
  const getImageCaption = (image) => {
    if (!image) return '鸟类图片';
    if (typeof image === 'string') {
      return '鸟类图片';
    }
    return image.caption || '鸟类图片';
  };

  const toAbsoluteImageUrl = (image) => {
    const imageUrl = getImageUrl(image);
    if (!imageUrl) return '/logo.png';
    if (imageUrl.startsWith('http')) return imageUrl;
    return imageUrl;
  };

  const currentImageUrl = toAbsoluteImageUrl(currentImage);
  const currentImageUnoptimized = !currentImageUrl.startsWith('/');

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
            {currentImage && typeof currentImage === 'object' && currentImage.location && `📍 ${currentImage.location}`}
            {currentImage && typeof currentImage === 'object' && currentImage.date && ` • ${new Date(currentImage.date).toLocaleDateString()}`}
          </p>
        </div>

        {/* 主图片 */}
        <div className={styles.imageContainer}>
          <Image
            src={currentImageUrl}
            alt={getImageCaption(currentImage)}
            width={1600}
            height={1000}
            unoptimized={currentImageUnoptimized}
            className={styles.mainImage}
            onError={(e) => {
              e.target.style.display = 'none';
              const placeholder = e.target.nextElementSibling;
              if (placeholder) {
                placeholder.style.display = 'flex';
              }
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
              (() => {
                const thumbnailUrl = toAbsoluteImageUrl(image);
                const thumbnailUnoptimized = !thumbnailUrl.startsWith('/');
                return (
                  <button
                    key={index}
                    className={`${styles.thumbnail} ${index === activeIndex ? styles.active : ''}`}
                    onClick={() => setActiveIndex(index)}
                  >
                    <Image
                      src={thumbnailUrl}
                      alt={`缩略图 ${index + 1}`}
                      width={200}
                      height={140}
                      unoptimized={thumbnailUnoptimized}
                      className={styles.thumbnailImage}
                    />
                  </button>
                );
              })()
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

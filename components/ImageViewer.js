import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDisplayDate } from '@/utils/localDate';
import Image from 'next/image';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import styles from '@/styles/ImageViewer.module.css';

const ImageViewer = ({ images, currentIndex, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useFocusTrap(dialogRef, Boolean(images?.length), { initialFocusRef: closeButtonRef });

  useEffect(() => {
    if (!images || images.length === 0) return;
    const nextIndex = Number.isFinite(currentIndex) ? currentIndex : 0;
    const clamped = Math.min(Math.max(nextIndex, 0), images.length - 1);
    setActiveIndex(clamped);
  }, [currentIndex, images]);

  const goToPrevious = useCallback(() => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

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
  const dialogLabel = getImageCaption(currentImage);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="presentation">
      <div
        ref={dialogRef}
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="关闭图片查看器"
        >
          ×
        </button>

        <div className={styles.imageInfo}>
          <h3 className={styles.imageTitle}>{dialogLabel}</h3>
          <p className={styles.imageMeta}>
            {currentImage &&
              typeof currentImage === 'object' &&
              currentImage.location &&
              `📍 ${currentImage.location}`}
            {currentImage &&
              typeof currentImage === 'object' &&
              currentImage.date &&
              ` • ${formatDisplayDate(currentImage.date, 'short')}`}
          </p>
        </div>

        <div className={styles.imageContainer}>
          <Image
            src={currentImageUrl}
            alt={dialogLabel}
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

        {images.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={goToPrevious}
              aria-label="上一张图片"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={goToNext}
              aria-label="下一张图片"
            >
              ›
            </button>
          </>
        )}

        {images.length > 1 && (
          <div className={styles.thumbnailContainer} role="list" aria-label="缩略图">
            {images.map((image, index) => {
              const thumbnailUrl = toAbsoluteImageUrl(image);
              const thumbnailUnoptimized = !thumbnailUrl.startsWith('/');
              return (
                <button
                  key={index}
                  type="button"
                  role="listitem"
                  className={`${styles.thumbnail} ${index === activeIndex ? styles.active : ''}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`查看第 ${index + 1} 张`}
                  aria-current={index === activeIndex ? 'true' : undefined}
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
            })}
          </div>
        )}

        {images.length > 1 && (
          <div className={styles.counter} aria-live="polite">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;

import styles from '@/styles/SkeletonCard.module.css';

const SkeletonCard = ({ type = 'bird', count = 1 }) => {
  const cards = Array.from({ length: count }, (_, index) => index);

  if (type === 'bird') {
    return (
      <>
        {cards.map((_, index) => (
          <div key={index} className={styles.birdCard}>
            <div className={styles.skeletonImage}></div>
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonTitle}></div>
              <div className={styles.skeletonSubtitle}></div>
              <div className={styles.skeletonText}></div>
              <div className={styles.skeletonText}></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'list') {
    return (
      <>
        {cards.map((_, index) => (
          <div key={index} className={styles.listItem}>
            <div className={styles.skeletonAvatar}></div>
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonTitle}></div>
              <div className={styles.skeletonText}></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === 'table') {
    return (
      <>
        {cards.map((_, index) => (
          <div key={index} className={styles.tableRow}>
            <div className={styles.skeletonCell}></div>
            <div className={styles.skeletonCell}></div>
            <div className={styles.skeletonCell}></div>
            <div className={styles.skeletonCell}></div>
          </div>
        ))}
      </>
    );
  }

  return null;
};

export default SkeletonCard;


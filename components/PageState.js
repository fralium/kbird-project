import styles from '@/styles/PageState.module.css';

export default function PageState({
  type = 'loading',
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  const resolvedTitle =
    title ||
    (type === 'loading'
      ? '加载中...'
      : type === 'error'
        ? '加载失败'
        : '暂无数据');

  const hasPrimary = Boolean(onAction && actionLabel);
  const hasSecondary = Boolean(onSecondaryAction && secondaryActionLabel);

  return (
    <div
      className={`${styles.container} ${
        type === 'error' ? styles.error : type === 'empty' ? styles.empty : styles.loading
      }`}
    >
      <h3 className={styles.title}>{resolvedTitle}</h3>
      {message ? <p className={styles.message}>{message}</p> : null}
      {hasPrimary || hasSecondary ? (
        <div className={styles.actions}>
          {hasPrimary ? (
            <button type="button" className={styles.actionButton} onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {hasSecondary ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

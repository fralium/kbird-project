'use client';

import styles from '@/styles/TaxonomyBrowse.module.css';

/**
 * Grid of order-level browse cards (label / latin / stat / progress).
 *
 * Card shape:
 * { key, label, latin?, stat, pct?, done?, active?, mark? }
 *
 * @param {(card) => void} onSelect
 */
export default function OrderBrowseGrid({
  cards = [],
  onSelect,
  emptyText = '没有匹配的目',
  className = '',
  emptyClassName = '',
}) {
  if (!cards.length) {
    return (
      <p className={[styles.empty, emptyClassName].filter(Boolean).join(' ')}>{emptyText}</p>
    );
  }

  return (
    <div className={[styles.orderGrid, className].filter(Boolean).join(' ')}>
      {cards.map((card) => {
        const pct = Number.isFinite(Number(card.pct))
          ? Math.max(0, Math.min(100, Number(card.pct)))
          : null;
        const done = Boolean(card.done);
        const active = Boolean(card.active);
        return (
          <button
            key={card.key}
            type="button"
            className={[
              styles.orderCard,
              done ? styles.orderCardDone : '',
              active ? styles.orderCardActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect?.(card)}
            aria-pressed={active}
          >
            <div className={styles.orderCardTop}>
              <div className={styles.orderCardTitleRow}>
                {card.mark ? <span className={styles.orderCardMark}>{card.mark}</span> : null}
                <div className={styles.orderCardTitle}>{card.label}</div>
              </div>
              <div className={styles.orderCardStat}>{card.stat}</div>
            </div>
            {card.latin ? <div className={styles.orderCardLatin}>{card.latin}</div> : null}
            {pct != null ? (
              <div className={styles.progressTrack}>
                <div
                  className={`${styles.progressFill} ${done ? styles.progressFillDone : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

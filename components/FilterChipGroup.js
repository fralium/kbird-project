'use client';

import styles from '@/styles/TaxonomyBrowse.module.css';

/**
 * Single-select filter chips (全部 / 已见 / 未见, etc.).
 *
 * @param {{ id: string, label: string }[]} options
 * @param {string} value
 * @param {(id: string) => void} onChange
 */
export default function FilterChipGroup({
  options = [],
  value,
  onChange,
  ariaLabel = '筛选',
  className = '',
  role = 'tablist',
}) {
  return (
    <div
      className={[styles.chipGroup, className].filter(Boolean).join(' ')}
      role={role}
      aria-label={ariaLabel}
    >
      {options.map((item) => {
        const id = String(item.id);
        const active = String(value) === id;
        return (
          <button
            key={id}
            type="button"
            role={role === 'tablist' ? 'tab' : undefined}
            aria-selected={role === 'tablist' ? active : undefined}
            aria-pressed={role !== 'tablist' ? active : undefined}
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={() => onChange?.(id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export const SEEN_FILTER_OPTIONS = [
  { id: 'all', label: '全部' },
  { id: 'unseen', label: '只看未见' },
  { id: 'seen', label: '只看已见' },
];

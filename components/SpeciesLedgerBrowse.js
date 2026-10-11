'use client';

import BirdSearchField from './BirdSearchField';
import FilterChipGroup, { SEEN_FILTER_OPTIONS } from './FilterChipGroup';
import OrderBrowseGrid from './OrderBrowseGrid';
import { BIRD_SEARCH_PLACEHOLDER_TAXON } from '@/utils/birdSearchUi';
import styles from '@/styles/SpeciesLedgerBrowse.module.css';

/**
 * Shared browse chrome above a species table:
 * progress + search + filter chips + order cards.
 * Pages own data; this only renders the shell.
 */
export default function SpeciesLedgerBrowse({
  progressLabel,
  progressPct = 0,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = BIRD_SEARCH_PLACEHOLDER_TAXON,
  filterOptions = SEEN_FILTER_OPTIONS,
  filterValue,
  onFilterChange,
  filterAriaLabel = '进度筛选',
  showFilterChips = true,
  orderCards = [],
  onSelectOrder,
  emptyOrderText = '没有匹配的目',
  headerExtra = null,
  className = '',
}) {
  const pct = Math.max(0, Math.min(100, Number(progressPct) || 0));

  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        {progressLabel != null ? (
          <div className={styles.progressBlock}>
            <div className={styles.progressLabel}>{progressLabel}</div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
        <BirdSearchField
          className={styles.search}
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          size="sm"
          roundedRect
        />
        {showFilterChips && filterOptions?.length ? (
          <FilterChipGroup
            className={styles.filters}
            options={filterOptions}
            value={filterValue}
            onChange={onFilterChange}
            ariaLabel={filterAriaLabel}
          />
        ) : null}
        {headerExtra}
      </div>
      <OrderBrowseGrid
        cards={orderCards}
        onSelect={onSelectOrder}
        emptyText={emptyOrderText}
      />
    </section>
  );
}

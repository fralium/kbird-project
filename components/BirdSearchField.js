'use client';

import {
  BIRD_SEARCH_ARIA_LABEL,
  BIRD_SEARCH_PLACEHOLDER,
} from '@/utils/birdSearchUi';
import styles from '@/styles/BirdSearchField.module.css';

/**
 * Unified bird search control (filter box).
 * Supports Chinese / pinyin / initials / scientific / English via callers' matchers or API.
 *
 * @param {'sm'|'md'|'lg'} [size]
 * @param {boolean} [roundedRect] use 8px corners instead of pill (forms)
 */
export default function BirdSearchField({
  value = '',
  onChange,
  onSubmit,
  placeholder = BIRD_SEARCH_PLACEHOLDER,
  ariaLabel = BIRD_SEARCH_ARIA_LABEL,
  className = '',
  size = 'md',
  clearable = true,
  disabled = false,
  autoFocus = false,
  name,
  id,
  inputRef,
  onKeyDown,
  roundedRect = false,
  ...rest
}) {
  const handleChange = (event) => {
    onChange?.(event.target.value);
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' && typeof onSubmit === 'function') {
      event.preventDefault();
      onSubmit(String(value || '').trim());
    }
  };

  const showClear = clearable && !disabled && String(value || '').length > 0;

  return (
    <div
      className={[
        styles.wrap,
        styles[`size_${size}`] || styles.size_md,
        roundedRect ? styles.roundedRect : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        ref={inputRef}
        type="search"
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        autoFocus={autoFocus}
        className={styles.input}
        autoComplete="off"
        spellCheck={false}
        {...rest}
      />
      {showClear ? (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange?.('')}
          aria-label="清空搜索"
          tabIndex={-1}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { api } from '@/utils/api';
import { extractLngLatPair } from '@/utils/locationCoords';
import styles from '@/styles/LocationAutocomplete.module.css';

const LocationAutocomplete = ({
  value,
  onChange,
  placeholder = '搜索或选择观鸟地点...',
  required = false,
  className = '',
  showHint = true,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const listboxId = useId();

  const inputText = typeof value === 'string' ? value : value?.name || '';

  const fetchSuggestions = useCallback(async (term) => {
    const q = String(term || '').trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.locations.getAll({
        page: '1',
        limit: '12',
        sortBy: 'name',
        sortOrder: 'asc',
        search: q,
      });
      if (data?.success && Array.isArray(data.data)) {
        setSuggestions(data.data);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const emitFreeText = (name) => {
    if (onChange && typeof onChange === 'function') {
      onChange({
        _id: null,
        name,
        coordinates: [0, 0],
      });
    }
  };

  const handleLocationSelect = (location) => {
    if (location && location.name && onChange && typeof onChange === 'function') {
      const coords = extractLngLatPair(location);
      onChange({
        _id: location._id || null,
        name: location.name,
        coordinates: coords || [0, 0],
        address: location.address || {},
      });
    }
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleInputChange = (e) => {
    const next = e.target.value || '';
    emitFreeText(next);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setShowDropdown(false);
      setSuggestions([]);
      return;
    }
    setShowDropdown(true);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(next);
    }, 220);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleLocationSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const listOpen = showDropdown && (suggestions.length > 0 || searching || inputText.trim().length > 0);

  return (
    <div className={`${styles.autocompleteContainer} ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (inputText.trim()) {
            setShowDropdown(true);
            fetchSuggestions(inputText);
          }
        }}
        placeholder={placeholder}
        required={required}
        className={styles.input}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
      />
      {showHint ? (
        <p
          style={{
            margin: '4px 0 0 0',
            fontSize: 'var(--type-caption)',
            color: 'var(--text-muted)',
          }}
        >
          建议从下拉列表选择已有地点，仅输入名称不会保存准确坐标。
        </p>
      ) : null}

      {listOpen ? (
        <div
          ref={dropdownRef}
          id={listboxId}
          className={styles.dropdown}
          role="listbox"
          aria-label="地点建议"
        >
          {searching && suggestions.length === 0 ? (
            <div className={styles.noResults} role="option" aria-selected="false">
              搜索中…
            </div>
          ) : null}
          {!searching && suggestions.length === 0 && inputText.trim().length > 0 ? (
            <div className={styles.noResults} role="option" aria-selected="false">
              未找到匹配的地点
            </div>
          ) : null}
          {suggestions.map((location, index) => (
            <button
              key={location._id || `${location.name}-${index}`}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`${styles.dropdownItem}${
                index === activeIndex ? ` ${styles.dropdownItemActive || ''}` : ''
              }`}
              onClick={() => handleLocationSelect(location)}
            >
              <div className={styles.locationName}>{location.name}</div>
              <div className={styles.locationAddress}>
                {location.address?.city || ''}
                {location.address?.district ? ` • ${location.address.district}` : ''}
              </div>
              <div className={styles.locationType}>{location.type}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default LocationAutocomplete;

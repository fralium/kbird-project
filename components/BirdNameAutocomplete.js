import { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import RequestNewBirdButton from './RequestNewBirdButton';
import BirdSearchField from './BirdSearchField';
import { findMatchedAlias } from '@/utils/birdAliasMatch';
import { BIRD_SEARCH_PLACEHOLDER } from '@/utils/birdSearchUi';
import styles from '@/styles/BirdNameAutocomplete.module.css';

const BirdNameAutocomplete = ({ 
  value, 
  onChange, 
  onSelect,
  onInputKeyDown,
  placeholder = BIRD_SEARCH_PLACEHOLDER, 
  required = false,
  className = "",
  containerProps = {}
}) => {
  const [filteredBirds, setFilteredBirds] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // 搜索鸟类
  const searchBirds = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 1) {
      setFilteredBirds([]);
      setShowDropdown(false);
      setSearchedEmpty(false);
      return;
    }

    // 清除之前的搜索定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 延迟搜索，避免频繁请求
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.birds.getAll({ search: searchTerm.trim(), limit: 10 });
        
        if (data.success && Array.isArray(data.data)) {
          setFilteredBirds(data.data);
          setSearchedEmpty(data.data.length === 0);
          setShowDropdown(true);
        } else {
          setFilteredBirds([]);
          setSearchedEmpty(true);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error('搜索鸟类失败:', error);
        setFilteredBirds([]);
        setSearchedEmpty(true);
        setShowDropdown(true);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms 延迟
  };

  const handleInputChange = (inputValue) => {
    const next = inputValue || '';
    if (onChange && typeof onChange === 'function') {
      onChange(next);
    }
    searchBirds(next);
  };

  // 选择鸟类
  const handleBirdSelect = (bird) => {
    if (onChange && typeof onChange === 'function') {
      onChange(bird.name);
    }
    
    if (onSelect && typeof onSelect === 'function') {
      onSelect(bird);
    }
    
    setShowDropdown(false);
    setFilteredBirds([]);
    setSearchedEmpty(false);
  };

  const handleRequested = (bird) => {
    handleBirdSelect(bird);
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setFilteredBirds([]);
      setSearchedEmpty(false);
    } else if (e.key === 'Enter' && filteredBirds.length > 0) {
      e.preventDefault();
      handleBirdSelect(filteredBirds[0]);
    }

    if (onInputKeyDown && typeof onInputKeyDown === 'function') {
      onInputKeyDown(e);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setFilteredBirds([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const showEmptyCta =
    showDropdown &&
    searchedEmpty &&
    filteredBirds.length === 0 &&
    value &&
    String(value).trim().length > 0 &&
    !loading;

  return (
    <div className={`${styles.autocompleteContainer} ${className}`} {...containerProps}>
      <BirdSearchField
        inputRef={inputRef}
        value={value || ''}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filteredBirds.length > 0 || searchedEmpty) {
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        required={required}
        roundedRect
        size="md"
        clearable={false}
      />
      
      {loading && (
        <div className={styles.loadingIndicator}>
          <span>搜索中...</span>
        </div>
      )}
      
      {showDropdown && filteredBirds.length > 0 && (
        <div ref={dropdownRef} className={styles.dropdown}>
          {filteredBirds.map((bird) => {
            const aliasHit = findMatchedAlias(bird, value);
            return (
            <div
              key={bird._id}
              className={styles.dropdownItem}
              onClick={() => handleBirdSelect(bird)}
            >
              <div className={styles.birdName}>{bird.name}</div>
              {aliasHit ? (
                <div className={styles.scientificName}>别名 {aliasHit}</div>
              ) : null}
              {bird.scientificName && (
                <div className={styles.scientificName}>{bird.scientificName}</div>
              )}
              {bird.category && (
                <div className={styles.category}>{bird.category}</div>
              )}
            </div>
            );
          })}
        </div>
      )}
      
      {showEmptyCta && (
        <div ref={dropdownRef} className={styles.dropdown}>
          <div className={styles.noResults}>
            <p className={styles.noResultsText}>库中暂无「{String(value).trim()}」</p>
            <RequestNewBirdButton
              name={String(value).trim()}
              onCreated={handleRequested}
              className={styles.requestButton}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BirdNameAutocomplete;

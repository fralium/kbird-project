import { useState, useEffect, useRef } from 'react';
import styles from '../styles/BirdAutocomplete.module.css';

export default function BirdAutocomplete({ 
  value, 
  onChange, 
  placeholder = "搜索鸟类...", 
  className = "",
  disabled = false 
}) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBird, setSelectedBird] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // 当外部value变化时更新内部状态
  useEffect(() => {
    console.log('BirdAutocomplete收到value:', value);
    if (value && value.name) {
      console.log('设置完整鸟类对象:', value);
      setSelectedBird(value);
      setInputValue(value.name);
    } else {
      console.log('清空值');
      setSelectedBird(null);
      setInputValue('');
    }
  }, [value]);

  // 搜索鸟类
  const searchBirds = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/birds?search=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data.data || []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('搜索鸟类失败:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (e) => {
    const query = e.target.value;
    setInputValue(query);
    
    // 如果输入为空，清空选择
    if (!query) {
      setSelectedBird(null);
      onChange && onChange(null);
      setSuggestions([]);
      return;
    }
    
    // 用户输入时，先清除当前选择，等待自动匹配
    setSelectedBird(null);
    onChange && onChange(null);
    
    // 延迟搜索，避免频繁请求
    const timeoutId = setTimeout(async () => {
      if (query.length >= 2) {
        const response = await fetch(`/api/birds?search=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          setSuggestions(data.data);
          
          // 尝试精确匹配
          const exactMatch = data.data.find(bird => bird.name === query);
          if (exactMatch) {
            console.log('自动匹配成功:', exactMatch);
            setSelectedBird(exactMatch);
            console.log('自动匹配调用onChange，传递鸟类对象:', exactMatch);
            onChange && onChange(exactMatch);
            // 不清空建议列表，让用户可以看到其他候选选项
          }
        } else {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  // 选择鸟类
  const handleSelectSuggestion = (bird) => {
    console.log('手动选择鸟类:', bird);
    setSelectedBird(bird);
    setInputValue(bird.name);
    setIsOpen(false);
    console.log('调用onChange，传递鸟类对象:', bird);
    onChange && onChange(bird);
  };

  // 清空选择
  const handleClear = () => {
    setSelectedBird(null);
    setInputValue('');
    onChange && onChange(null);
    inputRef.current?.focus();
  };

  // 处理输入框焦点
  const handleFocus = () => {
    console.log('输入框获得焦点, inputValue:', inputValue, 'length:', inputValue.length);
    if (inputValue.length >= 2) {
      console.log('设置isOpen为true');
      setIsOpen(true);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 调试信息
  console.log('BirdAutocomplete渲染状态:', {
    inputValue,
    isOpen,
    suggestionsCount: suggestions.length,
    selectedBird: selectedBird?.name || null
  });

  return (
    <div className={`${styles.container} ${className}`} ref={dropdownRef}>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.input}
        />
        
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
          </div>
        )}
        
        {selectedBird && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearButton}
            title="清空选择"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className={styles.dropdown}>
          {suggestions.map((bird) => (
            <div
              key={bird._id}
              className={styles.suggestion}
              onClick={() => handleSelectSuggestion(bird)}
            >
              <div className={styles.birdInfo}>
                <div className={styles.birdName}>{bird.name}</div>
                {bird.scientificName && (
                  <div className={styles.scientificName}>{bird.scientificName}</div>
                )}
              </div>
              {bird.images && bird.images.length > 0 && (
                <div className={styles.birdImage}>
                  <img 
                    src={bird.images[0].url} 
                    alt={bird.name}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && suggestions.length === 0 && !loading && inputValue.length >= 2 && !selectedBird && (
        <div className={styles.noResults}>
          <div className={styles.noResultsText}>未找到相关鸟类</div>
          <div className={styles.noResultsHint}>尝试使用中文名、拼音或学名搜索</div>
        </div>
      )}
    </div>
  );
}



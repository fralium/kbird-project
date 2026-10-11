import { useState } from 'react';
import { api } from '@/utils/api';
import RequestNewBirdButton from './RequestNewBirdButton';
import styles from '@/styles/BirdSearchAdder.module.css';

export default function BirdSearchAdder({ onAddBird, existingBirds = [] }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBird, setSelectedBird] = useState(null);

  // 搜索鸟类
  const searchBirds = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.birds.getAll({ search: query, limit: '10' });
      
      if (data.success && data.data) {
        // 过滤掉已经添加的鸟类
        const filteredSuggestions = data.data.filter(bird => 
          !existingBirds.some(existing => 
            existing.bird && existing.bird._id === bird._id
          )
        );
        setSuggestions(filteredSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('搜索鸟类失败:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (e) => {
    const query = e.target.value;
    setInputValue(query);
    setSelectedBird(null);

    if (query.length >= 2) {
      searchBirds(query);
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  // 选择鸟类
  const handleSelectBird = (bird) => {
    setSelectedBird(bird);
    setInputValue(bird.name);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleRequested = (bird) => {
    setSelectedBird(bird);
    setInputValue(bird.name);
    setIsOpen(false);
    setSuggestions([]);
  };

  // 添加鸟类到表单
  const handleAddBird = () => {
    if (selectedBird) {
      const newBird = {
        bird: selectedBird,
        count: 1,
        notes: '',
        images: []
      };
      
      onAddBird(newBird);
      
      // 重置状态
      setSelectedBird(null);
      setInputValue('');
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  // 处理输入框焦点
  const handleFocus = () => {
    if (suggestions.length > 0 || (inputValue.length >= 2 && !isLoading)) {
      setIsOpen(true);
    }
  };

  // 处理输入框失焦
  const handleBlur = () => {
    // 延迟关闭，让用户有时间点击建议 / 申请入库
    setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && selectedBird) {
      e.preventDefault();
      handleAddBird();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={styles.birdSearchAdder}>
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="中文名 / 拼音 / 首字母 / 学名 / 英文…"
            className={styles.searchInput}
          />
          {isLoading && (
            <div className={styles.loadingIndicator}>
              <div className={styles.spinner}></div>
            </div>
          )}
        </div>

        {/* 搜索结果下拉框 */}
        {isOpen && suggestions.length > 0 && (
          <div className={styles.suggestionsDropdown}>
            {suggestions.map((bird) => (
              <div
                key={bird._id}
                className={styles.suggestionItem}
                onClick={() => handleSelectBird(bird)}
              >
                <div className={styles.birdName}>{bird.name}</div>
                {bird.scientificName && (
                  <div className={styles.scientificName}>{bird.scientificName}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 选中状态显示 */}
        {selectedBird && (
          <div className={styles.selectedBird}>
            <div className={styles.selectedInfo}>
              <span className={styles.selectedName}>{selectedBird.name}</span>
              {selectedBird.scientificName && (
                <span className={styles.selectedScientific}>{selectedBird.scientificName}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddBird}
              className={styles.addButton}
            >
              + 添加
            </button>
          </div>
        )}

        {/* 无结果提示 + 申请入库 */}
        {isOpen && suggestions.length === 0 && inputValue.length >= 2 && !isLoading && !selectedBird && (
          <div className={styles.noResults}>
            <p className={styles.noResultsText}>库中暂无「{inputValue.trim()}」</p>
            <RequestNewBirdButton
              name={inputValue.trim()}
              onCreated={handleRequested}
              className={styles.requestButton}
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/SearchBox.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13082';

const SearchBox = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const router = useRouter();
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        console.error('Failed to parse search history:', e);
      }
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const performSearch = useCallback(async (searchTerm) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(searchTerm)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const json = await response.json();
      if (json.success && json.data) {
        setResults(json.data);

        setSearchHistory((prev) => {
          if (!searchTerm || prev.includes(searchTerm)) return prev;
          const newHistory = [searchTerm, ...prev].slice(0, 10);
          localStorage.setItem('searchHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      } else {
        setResults({ birds: [], locations: [], query: searchTerm });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query.trim());
      }, 300);
    } else {
      setResults(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      performSearch(query.trim());
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      if (onClose) onClose();
    }
  };

  const handleHistoryClick = (term) => {
    setQuery(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    if (onClose) onClose();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const birds = results?.birds || [];
  const locations = results?.locations || [];
  const total = birds.length + locations.length;

  return (
    <div className={styles.searchBox}>
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索鸟类、地点（至少 2 字）..."
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchButton}>
          🔍
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        )}
      </form>

      {results && query.trim().length >= 2 && (
        <div className={styles.results}>
          {loading ? (
            <div className={styles.loading}>搜索中...</div>
          ) : total === 0 ? (
            <div className={styles.noResults}>未找到相关结果</div>
          ) : (
            <>
              {birds.length > 0 && (
                <div className={styles.resultSection}>
                  <h3 className={styles.sectionTitle}>鸟类 ({birds.length})</h3>
                  {birds.map((bird) => (
                    <Link
                      key={bird._id}
                      href={`/birds/${bird._id}`}
                      className={styles.resultItem}
                      onClick={onClose}
                    >
                      <div className={styles.resultContent}>
                        <div className={styles.resultName}>{bird.name}</div>
                        <div className={styles.resultMeta}>{bird.scientificName}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {locations.length > 0 && (
                <div className={styles.resultSection}>
                  <h3 className={styles.sectionTitle}>地点 ({locations.length})</h3>
                  {locations.map((loc) => (
                    <Link
                      key={loc._id}
                      href={`/locations/${loc._id}`}
                      className={styles.resultItem}
                      onClick={onClose}
                    >
                      <div className={styles.resultContent}>
                        <div className={styles.resultName}>{loc.name}</div>
                        {loc.type && (
                          <div className={styles.resultMeta}>{loc.type}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className={styles.viewAll}>
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={onClose}
                >
                  在搜索页查看全部
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {!results && query.trim().length === 0 && searchHistory.length > 0 && (
        <div className={styles.history}>
          <div className={styles.historyHeader}>
            <span>搜索历史</span>
            <button type="button" onClick={clearHistory} className={styles.clearButton}>
              清除
            </button>
          </div>
          {searchHistory.map((term, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleHistoryClick(term)}
              className={styles.historyItem}
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBox;

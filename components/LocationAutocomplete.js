import { useState, useEffect, useRef } from 'react';
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
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const hasFetchedRef = useRef(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchAllLocations = async () => {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const allLocations = [];

      while (page <= totalPages && page <= 200) {
        const data = await api.locations.getAll({
          page: String(page),
          limit: String(pageSize),
          sortBy: 'name',
          sortOrder: 'asc',
        });

        if (!data.success) {
          throw new Error(data.message || '获取地点列表失败');
        }

        const pageLocations = Array.isArray(data.data) ? data.data : [];
        allLocations.push(...pageLocations);

        const parsedPages = Number(data.pagination?.totalPages || data.pages || 1);
        totalPages = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : totalPages;

        if (pageLocations.length === 0) break;
        page += 1;
      }

      return allLocations;
    };

    const fetchLocations = async () => {
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      try {
        const allLocations = await fetchAllLocations();
        setLocations(allLocations);
      } catch (error) {
        console.error('获取地点列表失败:', error);
      }
    };

    fetchLocations();
  }, []);

  const filterLocations = (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setFilteredLocations([]);
      return;
    }

    const keyword = searchTerm.toLowerCase();
    const filtered = locations.filter((location) => {
      const locationName = location.name || '';
      const cityName = location.address?.city || '';
      const districtName = location.address?.district || '';

      return (
        locationName.toLowerCase().includes(keyword) ||
        cityName.toLowerCase().includes(keyword) ||
        districtName.toLowerCase().includes(keyword)
      );
    });

    setFilteredLocations(filtered.slice(0, 10));
  };

  const handleInputChange = (e) => {
    const inputValue = e.target.value || '';
    if (onChange && typeof onChange === 'function') {
      onChange({
        _id: null,
        name: inputValue,
        coordinates: [0, 0],
      });
    }
    filterLocations(inputValue);
    setShowDropdown(inputValue.trim().length > 0);
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
    setFilteredLocations([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setFilteredLocations([]);
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
        setFilteredLocations([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const inputText = typeof value === 'string' ? value : value?.name || '';

  return (
    <div className={`${styles.autocompleteContainer} ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={styles.input}
        autoComplete="off"
      />
      {showHint ? (
        <p style={{ margin: '4px 0 0 0', fontSize: 'var(--type-caption)', color: 'var(--text-muted)'}}>
          建议从下拉列表选择已有地点，仅输入名称不会保存准确坐标。
        </p>
      ) : null}

      {showDropdown && filteredLocations.length > 0 && (
        <div ref={dropdownRef} className={styles.dropdown}>
          {filteredLocations.map((location) => (
            <div
              key={location._id}
              className={styles.dropdownItem}
              onClick={() => handleLocationSelect(location)}
            >
              <div className={styles.locationName}>{location.name}</div>
              <div className={styles.locationAddress}>
                {location.address?.city || ''}
                {location.address?.district ? ` • ${location.address.district}` : ''}
              </div>
              <div className={styles.locationType}>{location.type}</div>
            </div>
          ))}
        </div>
      )}

      {showDropdown && filteredLocations.length === 0 && inputText.trim().length > 0 && (
        <div ref={dropdownRef} className={styles.dropdown}>
          <div className={styles.noResults}>未找到匹配的地点</div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;


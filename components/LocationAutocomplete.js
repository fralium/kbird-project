import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import styles from '../styles/LocationAutocomplete.module.css';

// 全局变量防止重复请求 - 移除，使用组件内部状态管理

const LocationAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "搜索或选择观鸟地点...", 
  required = false,
  className = "" 
}) => {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false); // 使用ref防止重复请求
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // 获取地点列表
  useEffect(() => {
    const fetchLocations = async () => {
      // 防止重复请求 - 只使用ref
      if (hasFetchedRef.current) return;
      
      try {
        console.log('开始获取地点列表...');
        hasFetchedRef.current = true;
        
        const data = await api.locations.getAll();
        console.log('API响应数据:', data);
        
        if (data.success) {
          console.log('设置地点数据:', data.data);
          setLocations(data.data);
        } else {
          console.error('API返回失败:', data.message);
        }
      } catch (error) {
        console.error('获取地点列表失败:', error);
      }
    };

    fetchLocations();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 过滤地点
  const filterLocations = (searchTerm) => {
    console.log('搜索词:', searchTerm);
    console.log('地点数据:', locations);
    
    if (!searchTerm || !searchTerm.trim()) {
      setFilteredLocations([]);
      return;
    }

    const filtered = locations.filter(location => {
      // 处理可能的中文编码问题
      const locationName = location.name || '';
      const cityName = location.address?.city || '';
      const districtName = location.address?.district || '';
      
      const nameMatch = locationName.toLowerCase().includes(searchTerm.toLowerCase());
      const cityMatch = cityName.toLowerCase().includes(searchTerm.toLowerCase());
      const districtMatch = districtName.toLowerCase().includes(searchTerm.toLowerCase());
      
      console.log('地点:', locationName, '城市:', cityName, '区域:', districtName);
      console.log('搜索词:', searchTerm, '名称匹配:', nameMatch, '城市匹配:', cityMatch, '区域匹配:', districtMatch);
      
      return nameMatch || cityMatch || districtMatch;
    });

    console.log('过滤结果:', filtered);
    setFilteredLocations(filtered.slice(0, 10)); // 限制显示10个结果
  };

  // 处理输入变化
  const handleInputChange = (e) => {
    const inputValue = e.target.value || '';
    // 传递对象格式以匹配前端期望
    onChange({
      name: inputValue,
      coordinates: [0, 0] // 默认坐标，用户需要手动选择地点来获取准确坐标
    });
    filterLocations(inputValue);
    setShowDropdown(inputValue.trim().length > 0);
  };

  // 选择地点
  const handleLocationSelect = (location) => {
    if (location && location.name) {
      onChange({
        name: location.name,
        coordinates: location.coordinates || [0, 0]
      });
    }
    setShowDropdown(false);
    setFilteredLocations([]);
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setFilteredLocations([]);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setFilteredLocations([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`${styles.autocompleteContainer} ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={typeof value === 'string' ? value : (value?.name || '')}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={styles.input}
        autoComplete="off"
      />
      
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
                {location.address.city}
                {location.address.district && ` • ${location.address.district}`}
              </div>
              <div className={styles.locationType}>{location.type}</div>
            </div>
          ))}
        </div>
      )}
      
      {showDropdown && filteredLocations.length === 0 && value && (typeof value === 'string' ? value.trim().length > 0 : value.name?.trim().length > 0) && (
        <div ref={dropdownRef} className={styles.dropdown}>
          <div className={styles.noResults}>
            未找到匹配的地点
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;

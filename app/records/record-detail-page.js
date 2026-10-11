import { useState, useEffect, useMemo } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImageViewer from '@/components/ImageViewer';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import HabitatGallery from '@/components/HabitatGallery';
import { useAuth } from '@/components/AuthProvider';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '@/data/taxonomyTranslation';
import { getRecordBirdHighlight, sortRecordBirdsByImportance } from '@/data/protectionLevels';
import { api } from '@/utils/api';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { formatDisplayDate, formatDisplayDateTime, formatLocalDateKey } from '@/utils/localDate';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderSecondaryButton,
  HeaderTextLink,
} from '@/components/SimplePageHeader';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import SpeciesHoverChip from '@/components/SpeciesHoverChip';
import PageState from '@/components/PageState';
import styles from '@/styles/RecordDetail.module.css';
import outingStyles from '@/styles/OutingReport.module.css';

// 地图依赖 window/Leaflet，仅客户端加载，避免 SSR 报错 "window is not defined"
const BirdMapProvider = dynamic(() => import('@/components/BirdMapProvider'), { ssr: false });

function resolveRecordImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return url;
}

const RELATED_BIRD_PREVIEW = 10;

function formatRelatedOutingBirds(record) {
  const birds = Array.isArray(record?.birds) ? record.birds : [];
  const named = birds.filter((entry) =>
    String(entry?.birdId?.name || entry?.name || '').trim()
  );
  if (!named.length) {
    return { shown: [], total: birds.length };
  }
  const names = sortRecordBirdsByImportance(named).map((entry) =>
    String(entry?.birdId?.name || entry?.name || '').trim()
  );
  return {
    shown: names.slice(0, RELATED_BIRD_PREVIEW),
    total: names.length,
  };
}

function formatRecordRegion(location) {
  const fromAddress = formatAddressRegion(location?.address);
  if (fromAddress) return fromAddress;

  const municipalitySet = new Set(['北京市', '天津市', '上海市', '重庆市']);
  const raw = String(location?.name || '').trim();
  if (!raw) return '';

  const tokens =
    raw.match(
      /(北京市|天津市|上海市|重庆市|[^省\s]+省|[^自治区\s]+自治区|香港特别行政区|澳门特别行政区|台湾省|[^市\s]+市|[^区县旗\s]+区|[^区县旗\s]+县|[^区县旗\s]+旗)/g
    ) || [];

  if (tokens.length === 0) return '';

  const province = tokens.find((t) => /省$|自治区$|特别行政区$|台湾省$/.test(t) || municipalitySet.has(t)) || '';
  const city = tokens.find((t) => /市$/.test(t) && !municipalitySet.has(t)) || '';
  const district = tokens.find((t) => /区$|县$|旗$/.test(t)) || '';
  return formatAddressRegion({ province, city, district });
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

const OBSERVATION_METHOD_OPTIONS = [
  { value: 'walk', label: '步行' },
  { value: 'stationary', label: '定点' },
  { value: 'car', label: '车观' },
  { value: 'other', label: '其他' },
];

function normalizeObservationMethods(value) {
  const allowed = new Set(OBSERVATION_METHOD_OPTIONS.map((item) => item.value));
  const rawValues = Array.isArray(value) ? value : [value];
  const methods = rawValues
    .map((item) => String(item || '').trim())
    .filter((item) => allowed.has(item));
  const uniqueMethods = [...new Set(methods)];
  return uniqueMethods.length > 0 ? uniqueMethods : ['other'];
}

function formatObservationMethods(value) {
  const labels = normalizeObservationMethods(value).map(
    (method) =>
      OBSERVATION_METHOD_OPTIONS.find((item) => item.value === method)?.label || method
  );
  return labels.join('、');
}

export default function RecordDetail() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user, token } = useAuth();
  
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [birdTableSort, setBirdTableSort] = useState({ key: 'importance', dir: 'desc' });
  const [deleting, setDeleting] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [availableBirds, setAvailableBirds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedLocationCoords, setResolvedLocationCoords] = useState(null);
  const [syncLocationLoading, setSyncLocationLoading] = useState(false);
  const [syncLocationMessage, setSyncLocationMessage] = useState(null);
  const [catalogLocation, setCatalogLocation] = useState(null);
  const [habitatBusy, setHabitatBusy] = useState(false);
  const [nearbyRecords, setNearbyRecords] = useState([]);

  // 编辑表单数据
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    location: { name: '', coordinates: [0, 0] },
    date: '',
    notes: '',
    weather: '',
    temperature: '',
    humidity: '',
    wind: '',
    effort: {
      startTime: '',
      endTime: '',
      durationMinutes: '',
      distanceKm: '',
      observersCount: '',
      isCompleteChecklist: false,
      observationMethod: ['other'],
    },
    images: [],
    birds: []
  });

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  useEffect(() => {
    setBirdTableSort({ key: 'importance', dir: 'desc' });
  }, [id]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.records.getById(id);
      if (data.success) {
        setRecord(data.data);
          // 初始化编辑数据
          setEditData({
            title: data.data.title || '',
            description: data.data.description || '',
            location: data.data.location || { name: '', coordinates: [0, 0] },
            date: data.data.date ? formatLocalDateKey(data.data.date) : '',
            notes: data.data.notes || '',
            weather: data.data.weather || '',
            temperature: data.data.temperature || '',
            humidity: data.data.humidity || '',
            wind: data.data.wind || '',
            effort: {
              startTime: toDatetimeLocalValue(data.data.effort?.startTime),
              endTime: toDatetimeLocalValue(data.data.effort?.endTime),
              durationMinutes: data.data.effort?.durationMinutes ?? '',
              distanceKm: data.data.effort?.distanceKm ?? '',
              observersCount: data.data.effort?.observersCount ?? '',
              isCompleteChecklist: Boolean(data.data.effort?.isCompleteChecklist),
              observationMethod: normalizeObservationMethods(data.data.effort?.observationMethod),
            },
            images: data.data.images || [],
            birds: data.data.birds || []
          });
      } else {
        setError(data.message || '获取记录失败');
      }
    } catch (error) {
      console.error('获取记录失败:', error);
      setError('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 当记录有地点名但无有效坐标时，从地点名录按名称解析坐标用于地图展示
  useEffect(() => {
    if (!record || !record.location || !record.location.name) {
      setResolvedLocationCoords(null);
      setCatalogLocation(null);
      return;
    }
    const lat = record.location.coordinates?.coordinates?.[1] ?? record.location.coordinates?.[1];
    const lng = record.location.coordinates?.coordinates?.[0] ?? record.location.coordinates?.[0];
    const hasValid = lat != null && lng != null && !(Number(lat) === 0 && Number(lng) === 0);
    if (hasValid) {
      setResolvedLocationCoords(null);
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.locations.getByName(record.location.name);
        if (cancelled || !data.success || !data.data) {
          if (!cancelled) {
            setCatalogLocation(null);
            if (!hasValid) setResolvedLocationCoords(null);
          }
          return;
        }
        setCatalogLocation(data.data);
        if (!hasValid) {
          const coords = data.data.coordinates?.coordinates ?? data.data.coordinates;
          if (Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0)) {
            setResolvedLocationCoords({ lat: coords[1], lng: coords[0] });
          } else {
            setResolvedLocationCoords(null);
          }
        }
      } catch {
        if (!cancelled) {
          setCatalogLocation(null);
          if (!hasValid) setResolvedLocationCoords(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [record?.location?.name, record?.location?.coordinates]);

  useEffect(() => {
    const locationName = String(record?.location?.name || '').trim();
    const currentId = String(record?._id || id || '');
    if (!currentId || !locationName) {
      setNearbyRecords([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.records.getAll({
          location: locationName,
          limit: 20,
          sort: 'date_desc',
        });
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        const others = rows
          .filter((item) => {
            const itemId = String(item?._id || item?.id || '');
            return itemId && itemId !== currentId;
          })
          .filter((item) => String(item?.location?.name || '').trim() === locationName)
          .slice(0, 8);
        setNearbyRecords(others);
      } catch {
        if (!cancelled) setNearbyRecords([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, record?._id, record?.location?.name]);

  const handleSyncLocation = async () => {
    if (!id || !record) return;
    setSyncLocationMessage(null);
    setSyncLocationLoading(true);
    try {
      const data = await api.records.syncLocation(id);
      if (data.success) {
        setSyncLocationMessage('已从地点词典同步坐标');
        setResolvedLocationCoords(null);
        await fetchRecord();
      } else {
        setSyncLocationMessage(data.message || '同步失败');
      }
    } catch (e) {
      setSyncLocationMessage(e.message || '请求失败');
    } finally {
      setSyncLocationLoading(false);
    }
  };

  const handleHabitatUpload = async (file) => {
    if (!catalogLocation?._id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const uploaded = await api.upload.image(file);
      const url = uploaded?.data?.url;
      if (!uploaded?.success || !url) {
        throw new Error(uploaded?.message || '上传失败');
      }
      const data = await api.locations.addImage(catalogLocation._id, { url });
      if (!data.success) {
        throw new Error(data.message || '添加到生境库失败');
      }
      setCatalogLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatDelete = async (imageIndex) => {
    if (!catalogLocation?._id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.deleteImage(catalogLocation._id, imageIndex);
      if (!data.success) {
        throw new Error(data.message || '删除失败');
      }
      setCatalogLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatSetCover = async (imageIndex) => {
    if (!catalogLocation?._id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.setMainImage(catalogLocation._id, imageIndex);
      if (!data.success) {
        throw new Error(data.message || '设置封面失败');
      }
      setCatalogLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatUpdateCaption = async (imageIndex, caption) => {
    if (!catalogLocation?._id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.updateImage(catalogLocation._id, imageIndex, {
        caption,
      });
      if (!data.success) {
        throw new Error(data.message || '保存说明失败');
      }
      setCatalogLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const currentUserId = String(user?._id || user?.id || '');
  const observerId = String(record?.observer?._id || record?.observer || '');
  const canManageRecord = Boolean(
    user && record && (user.role === 'admin' || (currentUserId && currentUserId === observerId))
  );

  // 用于地图的坐标：优先用记录内的，否则用从地点名录解析的
  const mapCoords = (() => {
    if (!record?.location) return null;
    const lat = record.location.coordinates?.coordinates?.[1] ?? record.location.coordinates?.[1];
    const lng = record.location.coordinates?.coordinates?.[0] ?? record.location.coordinates?.[0];
    const hasRecord = lat != null && lng != null && !(Number(lat) === 0 && Number(lng) === 0);
    if (hasRecord) return { lat, lng };
    if (resolvedLocationCoords) return resolvedLocationCoords;
    return null;
  })();

  const taxonomyMeta = useMemo(() => {
    if (!record?.birds?.length) return null;
    const orderKeys = Array.from(
      new Set(
        record.birds
          .map((b) => b.birdId?.order)
          .filter((o) => o != null && String(o).trim() !== '')
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
    const familyKeys = Array.from(
      new Set(
        record.birds
          .map((b) => b.birdId?.family)
          .filter((f) => f != null && String(f).trim() !== '')
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));

    const orderToFamilySet = {};
    const familyToOrderSet = {};
    record.birds.forEach((b) => {
      const o = b.birdId?.order;
      const f = b.birdId?.family;
      if (o == null || f == null) return;
      const ok = String(o).trim();
      const fk = String(f).trim();
      if (!ok || !fk) return;
      if (!orderToFamilySet[ok]) orderToFamilySet[ok] = new Set();
      orderToFamilySet[ok].add(fk);
      if (!familyToOrderSet[fk]) familyToOrderSet[fk] = new Set();
      familyToOrderSet[fk].add(ok);
    });
    const orderToFamilyKeys = Object.fromEntries(
      Object.entries(orderToFamilySet).map(([k, set]) => [
        k,
        [...set].sort((a, b) => a.localeCompare(b)),
      ])
    );
    const familyToOrderKeys = Object.fromEntries(
      Object.entries(familyToOrderSet).map(([k, set]) => [
        k,
        [...set].sort((a, b) => a.localeCompare(b)),
      ])
    );

    const familyToSpecies = {};
    record.birds.forEach((b) => {
      const birdDoc = b.birdId && typeof b.birdId === 'object' ? b.birdId : null;
      const familyKey = String(birdDoc?.family || '').trim();
      const name = String(birdDoc?.name || b.name || '').trim();
      if (!familyKey || !name) return;
      if (!familyToSpecies[familyKey]) familyToSpecies[familyKey] = [];
      const idStr = birdDoc?._id ? String(birdDoc._id) : name;
      if (familyToSpecies[familyKey].some((item) => item.key === idStr)) return;
      familyToSpecies[familyKey].push({
        key: idStr,
        name,
        _id: birdDoc?._id || null,
        count: b.count || 1,
      });
    });
    Object.keys(familyToSpecies).forEach((key) => {
      familyToSpecies[key].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    });

    return {
      orderKeys,
      familyKeys,
      orderCount: orderKeys.length,
      familyCount: familyKeys.length,
      speciesCount: record.birds.length,
      totalIndividuals: record.birds.reduce((t, b) => t + (b.count || 1), 0),
      orderToFamilyKeys,
      familyToOrderKeys,
      familyToSpecies,
    };
  }, [record]);

  const sortedBirdEntries = useMemo(() => {
    if (!record?.birds?.length) return [];
    const entries = record.birds.map((bird, originalIndex) => ({ bird, originalIndex }));
    const { key, dir } = birdTableSort;
    if (key === 'seq') return entries;
    if (key === 'importance') {
      return [...entries].sort((a, b) => {
        const scoreA = getRecordBirdHighlight(a.bird).score;
        const scoreB = getRecordBirdHighlight(b.bird).score;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.originalIndex - b.originalIndex;
      });
    }
    const m = dir === 'asc' ? 1 : -1;
    const safeStr = (v) => (v == null || String(v).trim() === '' ? '\uffff' : String(v));
    const compare = (a, b) => {
      const A = a.bird;
      const B = b.bird;
      const bidA = A.birdId;
      const bidB = B.birdId;
      let cmp = 0;
      switch (key) {
        case 'name':
          cmp = safeStr(bidA?.name).localeCompare(safeStr(bidB?.name), 'zh-CN');
          break;
        case 'scientificName':
          cmp = safeStr(bidA?.scientificName).localeCompare(safeStr(bidB?.scientificName));
          break;
        case 'englishName':
          cmp = safeStr(bidA?.englishName).localeCompare(safeStr(bidB?.englishName));
          break;
        case 'order':
          cmp = safeStr(bidA?.order).localeCompare(safeStr(bidB?.order));
          break;
        case 'family':
          cmp = safeStr(bidA?.family).localeCompare(safeStr(bidB?.family));
          break;
        case 'count':
          cmp = (A.count || 1) - (B.count || 1);
          break;
        default:
          return 0;
      }
      if (cmp !== 0) return cmp * m;
      return a.originalIndex - b.originalIndex;
    };
    return [...entries].sort(compare);
  }, [record?.birds, birdTableSort]);

  const toggleBirdSort = (sortKey) => {
    setBirdTableSort((prev) =>
      prev.key === sortKey
        ? { key: sortKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: sortKey, dir: 'asc' }
    );
  };

  // 进入编辑模式
  const startEditing = () => {
    if (!canManageRecord) {
      setError('您没有权限编辑该记录');
      return;
    }
    setIsEditing(true);
    setSuccess(false);
  };

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false);
    setError('');
    setSuccess(false);
    // 重置编辑数据
    if (record) {
      setEditData({
        title: record.title || '',
        description: record.description || '',
        location: record.location || { name: '', coordinates: [0, 0] },
        date: record.date ? formatLocalDateKey(record.date) : '',
        notes: record.notes || '',
        weather: record.weather || '',
        temperature: record.temperature || '',
        humidity: record.humidity || '',
        wind: record.wind || '',
        effort: {
          startTime: toDatetimeLocalValue(record.effort?.startTime),
          endTime: toDatetimeLocalValue(record.effort?.endTime),
          durationMinutes: record.effort?.durationMinutes ?? '',
          distanceKm: record.effort?.distanceKm ?? '',
          observersCount: record.effort?.observersCount ?? '',
          isCompleteChecklist: Boolean(record.effort?.isCompleteChecklist),
          observationMethod: normalizeObservationMethods(record.effort?.observationMethod),
        },
        images: record.images || [],
        birds: record.birds || []
      });
    }
  };

  const handleDeleteRecord = async () => {
    if (!id || deleting) return;
    if (!canManageRecord) {
      setError('您没有权限删除该记录');
      return;
    }
    const ok = await ask('确定删除这条观察记录？删除后不能恢复。');
    if (!ok) return;

    try {
      setDeleting(true);
      setError('');

      const data = await api.records.delete(id);
      if (data.success) {
        router.push('/records');
      } else {
        setError(data.message || '删除失败，请重试');
      }
    } catch (err) {
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  // 搜索鸟类
  const searchBirds = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.birds.getAll({ search: query, limit: '20' });
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error('搜索鸟类失败:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addBird = (bird) => {
    // 检查是否已经添加
    if (
      editData.birds.find(
        (b) => String(b?.birdId?._id || b?.birdId || '') === String(bird._id)
      )
    ) {
      setError('该鸟类已经添加过了');
      return;
    }

    setEditData((prev) => ({
      ...prev,
      birds: [
        ...prev.birds,
        {
          birdId: bird,
          notes: '',
          images: [],
          count: 1,
        },
      ],
    }));
    setSearchResults([]);
    setSearchTerm('');
  };

  // 移除鸟类
  const removeBird = async (birdIndex) => {
    const ok = await ask('从这条记录里去掉这只鸟？保存后才会从库里拿掉。');
    if (!ok) return;
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.filter((_, index) => index !== birdIndex)
    }));
  };

  // 更新鸟类备注
  const updateBirdNotes = (birdIndex, notes) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex ? { ...bird, notes } : bird
      )
    }));
  };

  // 更新鸟类数量
  const updateBirdCount = (birdIndex, count) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex ? { ...bird, count: parseInt(count) || 1 } : bird
      )
    }));
  };

  // 处理鸟类图片上传
  const handleBirdImageUpload = async (birdIndex, e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    // 检查文件大小（10MB限制）
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setError(`以下文件过大，请选择小于10MB的图片文件：${oversizedFiles.map(f => f.name).join('，')}`);
      e.target.value = ''; // 清空文件输入
      return;
    }

    try {
      // 为每个文件创建FormData
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('未登录，请先登录');
        }
        
        // 直接调用后端API，绕过Next.js代理
        const data = await api.upload.image(file);
        if (data.success) {
          return {
            url: data.url || data.data?.url,
            caption: '',
            isNew: true
          };
        } else {
          throw new Error(`上传失败: ${data.message || '未知错误'}`);
        }
      });

      // 等待所有文件上传完成
      const uploadedImages = await Promise.all(uploadPromises);
      
      // 更新状态
      setEditData(prev => {
        const updatedBirds = prev.birds.map((bird, index) => 
          index === birdIndex 
            ? { ...bird, images: [...(bird.images || []), ...uploadedImages] }
            : bird
        );
        return {
          ...prev,
          birds: updatedBirds
        };
      });

    } catch (error) {
      console.error('图片上传失败:', error);
      setError(error?.message || '图片上传失败，请重试');
    }
  };

  // 删除鸟类图片
  const removeBirdImage = async (birdIndex, imageIndex) => {
    const ok = await ask('去掉这张照片？保存后才会从库里拿掉。');
    if (!ok) return;
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex 
          ? { ...bird, images: bird.images.filter((_, imgIdx) => imgIdx !== imageIndex) }
          : bird
      )
    }));
  };

  // 更新鸟类图片说明
  const updateBirdImageCaption = (birdIndex, imageIndex, caption) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex 
          ? { 
              ...bird, 
              images: bird.images.map((img, imgIdx) => 
                imgIdx === imageIndex ? { ...img, caption } : img
              )
            }
          : bird
      )
    }));
  };

  // 处理输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEffortChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      effort: {
        startTime: '',
        endTime: '',
        durationMinutes: '',
        distanceKm: '',
        observersCount: '',
        isCompleteChecklist: false,
        observationMethod: ['other'],
        ...(prev.effort || {}),
        [field]: value,
      },
    }));
  };

  // 处理地点变化
  const handleLocationChange = (location) => {
    setEditData(prev => ({
      ...prev,
      location: location
    }));
  };

  // 保存编辑
  const saveRecord = async () => {
    try {
      setSaving(true);
      setError('');

      // 验证必要字段
      if (!editData.title || !editData.location.name || !editData.date || editData.birds.length === 0) {
        setError('请填写标题、地点、日期，并至少添加一个鸟类');
        return;
      }

      // 准备地点：优先编辑态坐标，其次地图解析坐标，再尝试地点名录
      const resolveEditLocation = async () => {
        const loc = editData.location;
        const raw = loc?.coordinates;
        const coords = Array.isArray(raw) ? raw : (raw?.coordinates ?? null);
        let lng = Number(coords?.[0]);
        let lat = Number(coords?.[1]);
        const invalid = !Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0);

        if (invalid && resolvedLocationCoords) {
          lng = Number(resolvedLocationCoords.lng);
          lat = Number(resolvedLocationCoords.lat);
        }

        if (
          (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) &&
          loc?.name
        ) {
          try {
            const data = await api.locations.getByName(loc.name);
            const resolved = data?.success ? data.data : null;
            const pair = resolved?.coordinates?.coordinates ?? resolved?.coordinates;
            if (Array.isArray(pair) && pair.length >= 2) {
              lng = Number(pair[0]);
              lat = Number(pair[1]);
            }
          } catch {
            // fall through to validation error
          }
        }

        if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
          throw new Error('请设置有效的地点坐标（可从地点词典同步，或重新选择带坐标的地点）');
        }

        return {
          name: loc?.name || '',
          coordinates: { type: 'Point', coordinates: [lng, lat] },
          address: {
            province: loc?.address?.province || '',
            city: loc?.address?.city || '',
            district: loc?.address?.district || '',
            detail: loc?.address?.detail || loc?.address?.street || '',
          },
        };
      };

      // 准备数据
      const updateData = {
        title: editData.title,
        description: editData.description,
        location: await resolveEditLocation(),
        date: new Date(editData.date),
        notes: editData.notes,
        weather: editData.weather,
        temperature: editData.temperature,
        humidity: editData.humidity,
        wind: editData.wind,
        effort: {
          startTime: editData.effort?.startTime || null,
          endTime: editData.effort?.endTime || null,
          durationMinutes:
            editData.effort?.durationMinutes === '' ? null : Number(editData.effort?.durationMinutes),
          distanceKm: editData.effort?.distanceKm === '' ? null : Number(editData.effort?.distanceKm),
          observersCount:
            editData.effort?.observersCount === '' ? null : Number(editData.effort?.observersCount),
          isCompleteChecklist: Boolean(editData.effort?.isCompleteChecklist),
          observationMethod: normalizeObservationMethods(editData.effort?.observationMethod),
        },
        images: editData.images,
        birds: editData.birds
          .map((bird) => {
            const birdId = bird?.birdId?._id || bird?.birdId;
            if (!birdId) return null;
            return {
              birdId,
              notes: bird.notes,
              images: bird.images
                ? bird.images.map((img) => ({
                    url: img.url,
                    caption: img.caption || '',
                  }))
                : [],
              count: bird.count || 1,
            };
          })
          .filter(Boolean),
      };
      

      const data = await api.records.update(id, updateData);

      if (data.success) {
        setSuccess(true);
        setIsEditing(false);
        // 重新获取记录数据
        await fetchRecord();
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新记录失败:', error);
      setError(error?.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openImageViewer = (images, index = 0) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中..." />
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState
            type="error"
            title="错误"
            message={error}
            actionLabel="返回记录列表"
            onAction={() => router.push('/records')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  if (!record) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState
            type="error"
            title="记录不存在"
            message="您要查看的观鸟记录不存在或已被删除"
            actionLabel="返回记录列表"
            onAction={() => router.push('/records')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title={record.title}
          description={[
            formatDisplayDate(record.date, 'short'),
            formatRecordRegion(record.location) || record.location?.name || '地点未知',
          ]
            .filter(Boolean)
            .join(' · ')}
          descriptionVariant="caption"
          actions={
            <>
              <HeaderTextLink href="/records">返回列表</HeaderTextLink>
              {!isEditing && canManageRecord ? (
                <>
                  <HeaderPrimaryButton onClick={startEditing}>编辑记录</HeaderPrimaryButton>
                  <HeaderSecondaryButton onClick={handleDeleteRecord} disabled={deleting}>
                    {deleting ? '删除中…' : '删除'}
                  </HeaderSecondaryButton>
                </>
              ) : null}
            </>
          }
        />

        {/* 成功消息 */}
        {success && (
          <div className={styles.successMessage}>
            <p>✅ 记录更新成功！</p>
          </div>
        )}

        {/* 错误消息 */}
        {error && (
          <div className={styles.errorMessage}>
            <p>❌ {error}</p>
          </div>
        )}

        {/* 编辑表单 */}
        {isEditing && (
          <div className={styles.editForm}>
            <div className={styles.editFormHeader}>
              <h2>编辑观鸟记录</h2>
              <div className={styles.editActions}>
                <button 
                  onClick={cancelEditing} 
                  className={styles.cancelButton}
                  disabled={saving}
                >
                  取消
                </button>
                <button 
                  onClick={saveRecord} 
                  className={styles.saveButton}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            <form className={styles.form}>
              {/* 基本信息 */}
              <div className={styles.formSection}>
                <h3>基本信息</h3>
                
                <div className={styles.formGroup}>
                  <label htmlFor="title">记录标题 *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={editData.title}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">描述</label>
                  <textarea
                    id="description"
                    name="description"
                    value={editData.description}
                    onChange={handleInputChange}
                    placeholder="描述这次观鸟活动..."
                    rows="3"
                    className={styles.textarea}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="location">观察地点 *</label>
                  <LocationAutocomplete
                    value={editData.location.name}
                    onChange={handleLocationChange}
                    placeholder="搜索或选择观鸟地点..."
                    required={true}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="date">观察日期 *</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={editData.date}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              {/* 环境信息 */}
              <div className={styles.formSection}>
                <h3>环境信息</h3>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="weather">天气</label>
                    <input
                      type="text"
                      id="weather"
                      name="weather"
                      value={editData.weather}
                      onChange={handleInputChange}
                      placeholder="如：晴天、多云、小雨等"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="temperature">温度</label>
                    <input
                      type="number"
                      id="temperature"
                      name="temperature"
                      value={editData.temperature}
                      onChange={handleInputChange}
                      placeholder="℃"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="humidity">湿度</label>
                    <input
                      type="number"
                      id="humidity"
                      name="humidity"
                      value={editData.humidity}
                      onChange={handleInputChange}
                      placeholder="%"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="wind">风力</label>
                    <input
                      type="text"
                      id="wind"
                      name="wind"
                      value={editData.wind}
                      onChange={handleInputChange}
                      placeholder="如：微风、3级风等"
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3>观察努力</h3>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortStartTime">开始时间</label>
                    <input
                      type="datetime-local"
                      id="effortStartTime"
                      value={editData.effort?.startTime || ''}
                      onChange={(e) => handleEffortChange('startTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortEndTime">结束时间</label>
                    <input
                      type="datetime-local"
                      id="effortEndTime"
                      value={editData.effort?.endTime || ''}
                      onChange={(e) => handleEffortChange('endTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortDurationMinutes">观察时长(分钟)</label>
                    <input
                      type="number"
                      min="0"
                      id="effortDurationMinutes"
                      value={editData.effort?.durationMinutes || ''}
                      onChange={(e) => handleEffortChange('durationMinutes', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortDistanceKm">路线距离(km)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      id="effortDistanceKm"
                      value={editData.effort?.distanceKm || ''}
                      onChange={(e) => handleEffortChange('distanceKm', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortObserversCount">观察人数</label>
                    <input
                      type="number"
                      min="1"
                      id="effortObserversCount"
                      value={editData.effort?.observersCount || ''}
                      onChange={(e) => handleEffortChange('observersCount', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortObservationMethod">观察方式</label>
                    <div id="effortObservationMethod">
                      {OBSERVATION_METHOD_OPTIONS.map((option) => {
                        const checked = normalizeObservationMethods(
                          editData.effort?.observationMethod
                        ).includes(option.value);
                        return (
                          <label
                            key={option.value}
                            style={{ display: 'inline-flex', alignItems: 'center', marginRight: 12 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const prevMethods = normalizeObservationMethods(
                                  editData.effort?.observationMethod
                                );
                                const nextMethods = e.target.checked
                                  ? [...new Set([...prevMethods, option.value])]
                                  : prevMethods.filter((method) => method !== option.value);
                                handleEffortChange(
                                  'observationMethod',
                                  nextMethods.length > 0 ? nextMethods : ['other']
                                );
                              }}
                            />
                            <span style={{ marginLeft: 4 }}>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="effortCompleteChecklist">完整清单</label>
                    <select
                      id="effortCompleteChecklist"
                      value={editData.effort?.isCompleteChecklist ? 'yes' : 'no'}
                      onChange={(e) =>
                        handleEffortChange('isCompleteChecklist', e.target.value === 'yes')
                      }
                      className={styles.input}
                    >
                      <option value="no">否</option>
                      <option value="yes">是</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 鸟类管理 */}
              <div className={styles.formSection}>
                <h3>观察到的鸟类 *</h3>
                
                {/* 鸟类搜索 */}
                <div className={styles.birdSearch}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.length >= 2) {
                        searchBirds(e.target.value);
                      }
                    }}
                    placeholder="搜索鸟类名称或学名..."
                    className={styles.searchInput}
                  />
                  
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map(bird => (
                        <div
                          key={bird._id}
                          className={styles.birdOption}
                          onClick={() => addBird(bird)}
                        >
                          <div className={styles.birdInfo}>
                            <h4>{bird.name}</h4>
                            <p>{bird.scientificName}</p>
                          </div>
                          <button type="button" className={styles.addButton}>+</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 已选择的鸟类 */}
                <div className={styles.selectedBirds}>
                  <h4>已选择的鸟类 ({editData.birds.length})</h4>
                  {editData.birds.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>还没有选择任何鸟类</p>
                      <p>在上方搜索框中搜索并添加鸟类</p>
                    </div>
                  ) : (
                    <div className={styles.birdList}>
                      {editData.birds.map((bird, index) => (
                        <div key={index} className={styles.birdCard}>
                          <div className={styles.birdHeader}>
                            <div className={styles.birdInfo}>
                              <h4>{bird.birdId?.name || '未知鸟种'}</h4>
                              <p>{bird.birdId?.scientificName || ''}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeBird(index)}
                              className={styles.removeBird}
                            >
                              移除
                            </button>
                          </div>
                          
                          <div className={styles.birdDetails}>
                            <div className={styles.formGroup}>
                              <label>数量</label>
                              <input
                                type="number"
                                value={bird.count || 1}
                                onChange={(e) => updateBirdCount(index, e.target.value)}
                                min="1"
                                className={styles.countInput}
                              />
                            </div>
                            
                            <div className={styles.formGroup}>
                              <label>观察备注</label>
                              <textarea
                                value={bird.notes}
                                onChange={(e) => updateBirdNotes(index, e.target.value)}
                                placeholder="添加观察备注..."
                                className={styles.birdNotes}
                                rows="2"
                              />
                            </div>
                          </div>
                          
                          {/* 鸟类图片管理 */}
                          <div className={styles.birdImagesSection}>
                            <label>鸟类照片</label>
                            
                            {/* 图片上传按钮 */}
                            <div className={styles.imageUploadArea}>
                              <input
                                type="file"
                                id={`bird-images-${index}`}
                                accept="image/*"
                                multiple
                                onChange={(e) => handleBirdImageUpload(index, e)}
                                className={styles.hiddenFileInput}
                              />
                              <label 
                                htmlFor={`bird-images-${index}`}
                                className={styles.uploadButton}
                              >
                                📷 添加照片
                              </label>
                            </div>
                            
                            {/* 已上传的图片 */}
                            {bird.images && bird.images.length > 0 && (
                              <div className={styles.birdImageGrid}>
                                {bird.images.map((image, imgIndex) => (
                                  <div key={imgIndex} className={styles.birdImageItem}>
                                    <div className={styles.imageContainer}>
                                      <Image 
                                        src={image.url} 
                                        alt={`${bird.birdId?.name || '鸟类'} 照片 ${imgIndex + 1}`}
                                        width={260}
                                        height={180}
                                        unoptimized
                                        className={styles.birdImage}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeBirdImage(index, imgIndex)}
                                        className={styles.removeImageButton}
                                        title="删除照片"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={image.caption || ''}
                                      onChange={(e) => updateBirdImageCaption(index, imgIndex, e.target.value)}
                                      placeholder="照片说明..."
                                      className={styles.imageCaption}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 备注 */}
              <div className={styles.formSection}>
                <h3>备注</h3>
                <div className={styles.formGroup}>
                  <textarea
                    id="notes"
                    name="notes"
                    value={editData.notes}
                    onChange={handleInputChange}
                    placeholder="其他观察备注..."
                    rows="4"
                    className={styles.textarea}
                  />
                </div>
              </div>
            </form>
          </div>
        )}

        {/* VIEW：两栏报告布局 */}
        {!isEditing && (
          <>
            <div className={outingStyles.layout}>
              <aside className={outingStyles.leftCol}>
                <section className={outingStyles.panel}>
                  <div className={outingStyles.panelHead}>
                    <h2 className={outingStyles.panelTitle}>观察地点</h2>
                  </div>
                  <div className={outingStyles.mapFrame}>
                    {mapCoords ? (
                      <BirdMapProvider
                        locations={[
                          {
                            lat: mapCoords.lat,
                            lng: mapCoords.lng,
                            name: record.location?.name,
                            date: record.date,
                          },
                        ]}
                        center={{ lat: mapCoords.lat, lng: mapCoords.lng }}
                        zoom={14}
                        height="400px"
                      />
                    ) : (
                      <div className={outingStyles.mapEmpty}>
                        <p className={outingStyles.mapEmptyTitle}>暂无有效坐标</p>
                        <p className={outingStyles.mapEmptyHint}>
                          可在地点词典补全经纬度后同步到本记录。
                        </p>
                      </div>
                    )}
                  </div>
                  {record.location?.name ? (
                    <div className={outingStyles.mapLocationLabel}>
                      <strong>地点</strong>
                      {' · '}
                      {catalogLocation?._id ? (
                        <Link
                          href={`/locations/${catalogLocation._id}`}
                          className={outingStyles.mapLocationLink}
                        >
                          {record.location.name}
                        </Link>
                      ) : (
                        record.location.name
                      )}
                    </div>
                  ) : null}
                  {!mapCoords && canManageRecord ? (
                    <div className={outingStyles.mapActions}>
                      <button
                        type="button"
                        className={outingStyles.syncBtn}
                        onClick={handleSyncLocation}
                        disabled={syncLocationLoading}
                      >
                        {syncLocationLoading ? '同步中…' : '从地点词典同步坐标'}
                      </button>
                    </div>
                  ) : null}
                  {syncLocationMessage ? (
                    <p
                      className={`${outingStyles.syncMsg} ${
                        syncLocationMessage.includes('已')
                          ? outingStyles.syncMsgOk
                          : outingStyles.syncMsgErr
                      }`}
                    >
                      {syncLocationMessage}
                    </p>
                  ) : null}
                </section>

                <section className={outingStyles.panel}>
                  <div className={outingStyles.panelHead}>
                    <h2 className={outingStyles.panelTitle}>记录信息</h2>
                  </div>
                  <table className={outingStyles.metaTable}>
                    <tbody>
                      <tr>
                        <th scope="row">日期</th>
                        <td>{formatDisplayDate(record.date, 'short')}</td>
                      </tr>
                      <tr>
                        <th scope="row">地点</th>
                        <td>
                          {catalogLocation?._id ? (
                            <Link
                              href={`/locations/${catalogLocation._id}`}
                              className={outingStyles.mapLocationLink}
                            >
                              {record.location?.name || catalogLocation.name}
                            </Link>
                          ) : (
                            record.location?.name || '—'
                          )}
                        </td>
                      </tr>
                      {record.description ? (
                        <tr>
                          <th scope="row">描述</th>
                          <td className={outingStyles.metaProse}>{record.description}</td>
                        </tr>
                      ) : null}
                      {record.notes ? (
                        <tr>
                          <th scope="row">备注</th>
                          <td className={outingStyles.metaProse}>{record.notes}</td>
                        </tr>
                      ) : null}
                      {record.weather ? (
                        <tr>
                          <th scope="row">天气</th>
                          <td>
                            {record.weather}
                            {record.temperature != null && record.temperature !== ''
                              ? ` · ${record.temperature}°C`
                              : ''}
                          </td>
                        </tr>
                      ) : null}
                      {(() => {
                        const effort = record.effort || {};
                        const methods = normalizeObservationMethods(effort.observationMethod);
                        const hasMeaningfulMethod = !(
                          methods.length === 1 && methods[0] === 'other'
                        );
                        const bits = [];
                        if (effort.durationMinutes != null) {
                          bits.push(`${effort.durationMinutes} 分钟`);
                        }
                        if (effort.distanceKm != null) bits.push(`${effort.distanceKm} km`);
                        if (effort.observersCount != null) {
                          bits.push(`${effort.observersCount} 人`);
                        }
                        if (hasMeaningfulMethod) {
                          bits.push(formatObservationMethods(effort.observationMethod));
                        }
                        if (effort.isCompleteChecklist) bits.push('完整清单');
                        if (!bits.length && !effort.startTime && !effort.endTime) return null;
                        return (
                          <tr>
                            <th scope="row">努力</th>
                            <td>
                              {bits.length ? bits.join(' · ') : null}
                              {effort.startTime || effort.endTime ? (
                                <span className={outingStyles.muted}>
                                  {bits.length ? ' · ' : ''}
                                  {effort.startTime
                                    ? formatDisplayDateTime(effort.startTime)
                                    : ''}
                                  {effort.startTime && effort.endTime ? ' → ' : ''}
                                  {effort.endTime
                                    ? formatDisplayDateTime(effort.endTime)
                                    : ''}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })()}
                      {taxonomyMeta ? (
                        <tr>
                          <th scope="row">小结</th>
                          <td>
                            {[
                              `${taxonomyMeta.speciesCount} 种`,
                              `${taxonomyMeta.orderCount} 目`,
                              `${taxonomyMeta.familyCount} 科`,
                              taxonomyMeta.totalIndividuals !== taxonomyMeta.speciesCount
                                ? `${taxonomyMeta.totalIndividuals} 只`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </section>
              </aside>

              <section className={outingStyles.rightCol}>
                <div className={outingStyles.panel}>
                  <div className={outingStyles.panelHead}>
                    <h2 className={outingStyles.panelTitle}>鸟种列表</h2>
                    <span className={outingStyles.panelMeta}>
                      {taxonomyMeta ? `${taxonomyMeta.speciesCount} 种` : '—'}
                    </span>
                  </div>
                  {Array.isArray(record.birds) && record.birds.length === 0 ? (
                    <p className={outingStyles.emptyTable}>本条记录尚未添加鸟类。</p>
                  ) : (
                    <div className={outingStyles.tableWrap}>
                      <table className={outingStyles.speciesTable}>
                        <thead>
                          <tr>
                            <th scope="col" className={outingStyles.thIndex}>
                              #
                            </th>
                            <th scope="col">
                              <button
                                type="button"
                                className={outingStyles.sortBtn}
                                onClick={() => toggleBirdSort('name')}
                              >
                                中文名
                                <span className={outingStyles.sortIcon} aria-hidden>
                                  {birdTableSort.key === 'name'
                                    ? birdTableSort.dir === 'asc'
                                      ? '↑'
                                      : '↓'
                                    : '⇅'}
                                </span>
                              </button>
                            </th>
                            <th scope="col">
                              <button
                                type="button"
                                className={outingStyles.sortBtn}
                                onClick={() => toggleBirdSort('scientificName')}
                              >
                                学名
                                <span className={outingStyles.sortIcon} aria-hidden>
                                  {birdTableSort.key === 'scientificName'
                                    ? birdTableSort.dir === 'asc'
                                      ? '↑'
                                      : '↓'
                                    : '⇅'}
                                </span>
                              </button>
                            </th>
                            <th scope="col">
                              <button
                                type="button"
                                className={outingStyles.sortBtn}
                                onClick={() => toggleBirdSort('englishName')}
                              >
                                英文名
                                <span className={outingStyles.sortIcon} aria-hidden>
                                  {birdTableSort.key === 'englishName'
                                    ? birdTableSort.dir === 'asc'
                                      ? '↑'
                                      : '↓'
                                    : '⇅'}
                                </span>
                              </button>
                            </th>
                            <th scope="col">
                              <button
                                type="button"
                                className={outingStyles.sortBtn}
                                onClick={() => toggleBirdSort('count')}
                              >
                                数量
                                <span className={outingStyles.sortIcon} aria-hidden>
                                  {birdTableSort.key === 'count'
                                    ? birdTableSort.dir === 'asc'
                                      ? '↑'
                                      : '↓'
                                    : '⇅'}
                                </span>
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedBirdEntries.map(({ bird, originalIndex }, rowIdx) => {
                            const bid = bird.birdId;
                            const highlight = getRecordBirdHighlight(bird);
                            const idStr = bid?._id ? String(bid._id) : '';
                            return (
                              <tr
                                key={`${idStr}-${originalIndex}`}
                                className={
                                  highlight.notable ? outingStyles.rowNotable : undefined
                                }
                              >
                                <td className={outingStyles.tdIndex}>{rowIdx + 1}</td>
                                <td>
                                  <div className={outingStyles.nameCell}>
                                    {bid?._id ? (
                                      <SpeciesHoverChip
                                        name={bid.name || ''}
                                        href={`/birds/${bid._id}`}
                                        className={`${outingStyles.nameLink} ${
                                          highlight.notable ? outingStyles.nameNotable : ''
                                        }`}
                                      >
                                        {bid.name || '—'}
                                      </SpeciesHoverChip>
                                    ) : (
                                      <span
                                        className={
                                          highlight.notable
                                            ? outingStyles.nameNotable
                                            : undefined
                                        }
                                      >
                                        —
                                      </span>
                                    )}
                                    {highlight.shortLabel ? (
                                      <span
                                        className={outingStyles.protectBadge}
                                        title={[highlight.china, highlight.iucn]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      >
                                        {highlight.shortLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className={outingStyles.scientific}>
                                  {bid?.scientificName || '—'}
                                </td>
                                <td className={outingStyles.englishName}>
                                  {bid?.englishName || '—'}
                                </td>
                                <td className={outingStyles.tdCount}>{bird.count || 1}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className={outingStyles.belowLayout}>
              {taxonomyMeta ? (
                <section className={outingStyles.prosePanel}>
                  <div className={outingStyles.proseHead}>
                    <h2>分类明细</h2>
                    <HeaderSecondaryButton
                      onClick={() => {
                        setShowDetails((prev) => {
                          if (prev) {
                            setSelectedOrder('');
                            setSelectedFamily('');
                          }
                          return !prev;
                        });
                      }}
                      aria-expanded={showDetails}
                    >
                      {showDetails ? '收起' : '展开'}
                    </HeaderSecondaryButton>
                  </div>
                  {showDetails ? (
                    <div className={styles.detailsSection}>
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailsCard}>
                          <div className={styles.detailsCardHead}>
                            <div className={styles.detailsCardHeadText}>
                              <h4 className={styles.detailsTitle}>目</h4>
                              <span className={styles.detailsSubtitle}>
                                {selectedOrder
                                  ? `已选 1 / ${taxonomyMeta.orderCount}`
                                  : `${taxonomyMeta.orderCount} 项`}
                              </span>
                            </div>
                          </div>
                          <div className={styles.detailsTagGrid} role="group" aria-label="目">
                            {taxonomyMeta.orderKeys.map((order) => {
                              const isActive = selectedOrder === order;
                              const linkedOrders = selectedFamily
                                ? taxonomyMeta.familyToOrderKeys[selectedFamily] || []
                                : [];
                              const isLinked = !isActive && linkedOrders.includes(order);
                              const hasFilter = Boolean(selectedOrder || selectedFamily);
                              const isMuted = hasFilter && !isActive && !isLinked;
                              return (
                                <button
                                  key={order}
                                  type="button"
                                  className={`${styles.detailsTagOrder} ${
                                    isActive ? styles.detailsTagOrderActive : ''
                                  } ${isLinked ? styles.detailsTagOrderLinked : ''} ${
                                    isMuted ? styles.detailsTagMuted : ''
                                  }`}
                                  aria-pressed={isActive}
                                  onClick={() => {
                                    if (selectedOrder === order) {
                                      setSelectedOrder('');
                                      return;
                                    }
                                    setSelectedOrder(order);
                                    const families =
                                      taxonomyMeta.orderToFamilyKeys[order] || [];
                                    if (selectedFamily && !families.includes(selectedFamily)) {
                                      setSelectedFamily('');
                                    }
                                  }}
                                >
                                  {formatTaxonomyDisplay(getOrderChineseName(order), order)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className={styles.detailsCard}>
                          <div className={styles.detailsCardHead}>
                            <div className={styles.detailsCardHeadText}>
                              <h4 className={styles.detailsTitle}>科</h4>
                              <span className={styles.detailsSubtitle}>
                                {selectedOrder
                                  ? `${(taxonomyMeta.orderToFamilyKeys[selectedOrder] || []).length} / ${taxonomyMeta.familyCount} 项`
                                  : `${taxonomyMeta.familyCount} 项`}
                              </span>
                            </div>
                          </div>
                          <div className={styles.detailsTagGrid} role="group" aria-label="科">
                            {taxonomyMeta.familyKeys.map((family) => {
                              const isActive = selectedFamily === family;
                              const linkedFamilies = selectedOrder
                                ? taxonomyMeta.orderToFamilyKeys[selectedOrder] || []
                                : [];
                              const isLinked = !isActive && linkedFamilies.includes(family);
                              const hasFilter = Boolean(selectedOrder || selectedFamily);
                              const isMuted = hasFilter && !isActive && !isLinked;
                              return (
                                <button
                                  key={family}
                                  type="button"
                                  className={`${styles.detailsTagFamily} ${
                                    isActive ? styles.detailsTagFamilyActive : ''
                                  } ${isLinked ? styles.detailsTagFamilyLinked : ''} ${
                                    isMuted ? styles.detailsTagMuted : ''
                                  }`}
                                  aria-pressed={isActive}
                                  onClick={() => {
                                    if (selectedFamily === family) {
                                      setSelectedFamily('');
                                      return;
                                    }
                                    setSelectedFamily(family);
                                    const orders =
                                      taxonomyMeta.familyToOrderKeys[family] || [];
                                    if (orders.length && !orders.includes(selectedOrder)) {
                                      setSelectedOrder(orders[0]);
                                    }
                                  }}
                                >
                                  {formatTaxonomyDisplay(getFamilyChineseName(family), family)}
                                </button>
                              );
                            })}
                          </div>
                          {selectedFamily && taxonomyMeta.familyToSpecies?.[selectedFamily] ? (
                            <div className={styles.detailsSpeciesPanel}>
                              <p className={styles.detailsSpeciesCaption}>
                                {formatTaxonomyDisplay(
                                  getFamilyChineseName(selectedFamily),
                                  selectedFamily
                                )}
                                {' · '}
                                {taxonomyMeta.familyToSpecies[selectedFamily].length} 种
                              </p>
                              <div className={styles.detailsSpeciesList}>
                                {taxonomyMeta.familyToSpecies[selectedFamily].map((item) =>
                                  item._id ? (
                                    <Link
                                      key={item.key}
                                      href={`/birds/${item._id}`}
                                      className={styles.detailsSpeciesLink}
                                    >
                                      {item.name}
                                    </Link>
                                  ) : (
                                    <span key={item.key} className={styles.detailsSpeciesLink}>
                                      {item.name}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className={styles.detailsSpeciesHint}>
                              {selectedOrder
                                ? '点高亮科查看本次记录中的种'
                                : '点目看关联科，点科看本次的种'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {catalogLocation?._id ? (
                <HabitatGallery
                  title="地点生境图"
                  images={catalogLocation.images || []}
                  canUpload={Boolean(token)}
                  canDelete={Boolean(token)}
                  onUpload={handleHabitatUpload}
                  onDelete={handleHabitatDelete}
                  onSetCover={token ? handleHabitatSetCover : undefined}
                  onUpdateCaption={token ? handleHabitatUpdateCaption : undefined}
                  hint={
                    Array.isArray(catalogLocation.images) &&
                    catalogLocation.images.some((img) => img?.url)
                      ? '生境库照片；第一张为封面。证据照请在编辑里管理。'
                      : undefined
                  }
                  emptyText="还没有生境照片"
                />
              ) : null}

              {nearbyRecords.length > 0 ? (
                <section className={outingStyles.prosePanel}>
                  <h2>此地的其他观鸟记录</h2>
                  <ul className={outingStyles.relatedList}>
                    {nearbyRecords.map((item) => {
                      const dateLabel = item.date
                        ? formatDisplayDate(item.date, 'short')
                        : '日期未知';
                      const outingBirds = formatRelatedOutingBirds(item);
                      return (
                        <li key={item._id}>
                          <Link href={`/records/${item._id}`} className={outingStyles.relatedLink}>
                            <span className={outingStyles.relatedDate}>{dateLabel}</span>
                            {outingBirds.shown.length > 0 ? (
                              <span
                                className={outingStyles.relatedBirds}
                                title={`${outingBirds.shown.join('、')}${
                                  outingBirds.total > outingBirds.shown.length
                                    ? ` 等共 ${outingBirds.total} 种`
                                    : ` 共 ${outingBirds.total} 种`
                                }`}
                              >
                                {outingBirds.shown.join(' · ')}
                                <span className={outingStyles.relatedBirdCount}>
                                  {' '}
                                  共{outingBirds.total}种
                                </span>
                              </span>
                            ) : (
                              <span className={outingStyles.relatedBirds}>—</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          </>
        )}
      </main>

      <Footer />

      {confirmDialog}

      {/* 图片查看器 */}
      {imageViewerOpen && (
        <ImageViewer
          images={currentImages}
          currentIndex={currentImageIndex}
          onClose={closeImageViewer}
        />
      )}
    </div>
  );
}

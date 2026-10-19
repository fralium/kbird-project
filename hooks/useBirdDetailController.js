'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/utils/api';
import { useBirdImageUpload } from '@/hooks/useBirdImageUpload';
import { formatDisplayDate, formatLocalDateKey, todayLocalDateKey } from '@/utils/localDate';
import { normalizeBirdImageTags } from '@/data/birdImageTags';
import { normalizeBirdCallTags } from '@/data/birdCallTags';
import {
  useCompareTray,
  writeCompareTray,
  extractSimilarBirdNames,
  MAX_COMPARE_ITEMS,
} from '@/utils/compareStore';

const OUTING_BIRD_PREVIEW = 10;
const CHINA_THREAT_RANK = {
  国家一级: 0,
  国家二级: 1,
};
const IUCN_THREAT_RANK = {
  '灭绝(EX)': 0,
  '野外灭绝(EW)': 1,
  '极危(CR)': 2,
  '濒危(EN)': 3,
  '易危(VU)': 4,
  '近危(NT)': 5,
};

const outingBirdThreatScore = (item) => {
  const china = CHINA_THREAT_RANK[item.chinaProtectionLevel];
  if (china != null) return china;
  const iucn = IUCN_THREAT_RANK[item.iucnProtectionLevel];
  if (iucn != null) return 10 + iucn;
  return 40;
};

export const formatOutingBirds = (sighting, currentName) => {
  const listed = Array.isArray(sighting?.speciesList) && sighting.speciesList.length
    ? sighting.speciesList
        .map((item) => ({
          name: String(item?.name || '').trim(),
          chinaProtectionLevel: item?.chinaProtectionLevel || '',
          iucnProtectionLevel: item?.iucnProtectionLevel || '',
        }))
        .filter((item) => item.name)
    : (Array.isArray(sighting?.speciesNames) ? sighting.speciesNames : [])
        .map((name) => ({
          name: String(name || '').trim(),
          chinaProtectionLevel: '',
          iucnProtectionLevel: '',
        }))
        .filter((item) => item.name);

  const others = listed.filter((item) => item.name !== currentName);
  if (!others.length) return null;
  others.sort((a, b) => {
    const threat = outingBirdThreatScore(a) - outingBirdThreatScore(b);
    if (threat !== 0) return threat;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  const shown = others.slice(0, OUTING_BIRD_PREVIEW).map((item) => item.name);
  const total = Number(sighting?.speciesCount) || listed.length;
  return {
    shown,
    total,
    overflow: others.length > shown.length,
  };
};

export function useBirdDetailController(id, { mode = 'notebook', router } = {}) {
  const { user } = useAuth();
  const [bird, setBird] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCall, setUploadingCall] = useState(false);
  const [error, setError] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [editingCall, setEditingCall] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editCallFormData, setEditCallFormData] = useState({});
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSightingImageViewer, setShowSightingImageViewer] = useState(false);
  const [currentSightingImageIndex, setCurrentSightingImageIndex] = useState(0);
  const [currentSightingImages, setCurrentSightingImages] = useState([]);
  const [managingImages, setManagingImages] = useState(false);
  const [compactImages, setCompactImages] = useState(false);
  const [sightingSort, setSightingSort] = useState('date');
  const [detailTab, setDetailTab] = useState(mode === 'classic' ? 'info' : 'plate');
  const [comparingLoading, setComparingLoading] = useState(false);
  const lastTabBirdId = useRef('');
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const { hasItem: isInCompareTray, toggle: toggleCompare } = useCompareTray();

  const notify = useCallback((message, type = 'error') => {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(message, type, type === 'success' ? 2500 : 3000);
    }
    if (type === 'error') {
      setError(message);
    }
  }, []);

  const { uploadFile, uploading, error: uploadError, setError: setUploadError } = useBirdImageUpload(id, {
    onSuccess: (data) => {
      setBird((prevBird) => ({
        ...prevBird,
        ...data.data,
        sightings: prevBird?.sightings ?? [],
        calls: Array.isArray(data.data?.calls)
          ? [...data.data.calls].sort((a, b) => (a.order || 0) - (b.order || 0))
          : prevBird?.calls ?? [],
      }));
      notify('图片上传成功', 'success');
    },
  });

  const fetchBirdData = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;

      try {
        const cacheBustParams = forceRefresh ? { t: Date.now(), r: Math.random() } : {};
        const [birdData, sightingsData] = await Promise.all([
          api.birds.getById(id, cacheBustParams, {
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          }),
          api.records.getByBird(id, { ...cacheBustParams, limit: 500, page: 1 }),
        ]);

        if (birdData.success) {
          const birdResponse = birdData.data;
          let sightings = [];

          if (sightingsData.success) {
            sightings = Array.isArray(sightingsData.data) ? [...sightingsData.data] : [];
            const totalPages = Number(sightingsData.pagination?.totalPages || 1);
            if (totalPages > 1) {
              const pageRequests = [];
              for (let page = 2; page <= totalPages; page += 1) {
                pageRequests.push(api.records.getByBird(id, { ...cacheBustParams, limit: 500, page }));
              }
              const rest = await Promise.allSettled(pageRequests);
              rest.forEach((result) => {
                if (result.status === 'fulfilled' && result.value?.success && Array.isArray(result.value.data)) {
                  sightings.push(...result.value.data);
                }
              });
            }
          }

          birdResponse.sightings = sightings;
          if (Array.isArray(birdResponse.images) && birdResponse.images.length > 0) {
            birdResponse.images = [...birdResponse.images].sort((a, b) => (a.order || 0) - (b.order || 0));
          }
          if (Array.isArray(birdResponse.calls) && birdResponse.calls.length > 0) {
            birdResponse.calls = [...birdResponse.calls].sort((a, b) => (a.order || 0) - (b.order || 0));
          } else if (!Array.isArray(birdResponse.calls)) {
            birdResponse.calls = [];
          }

          setBird(birdResponse);
          const birdKey = String(birdResponse._id || id);
          if (lastTabBirdId.current !== birdKey) {
            lastTabBirdId.current = birdKey;
            if (mode === 'classic') {
              if (birdResponse.images?.length) setDetailTab('images');
              else if (sightings.length) setDetailTab('sightings');
              else if (birdResponse.calls?.length) setDetailTab('calls');
              else setDetailTab('info');
            } else {
              setDetailTab('plate');
            }
          }
        } else {
          setError(birdData.message || '获取鸟类数据失败');
        }
      } catch (fetchError) {
        console.error('获取鸟类数据失败:', fetchError);
        setError(fetchError?.message || '获取鸟类数据失败');
      } finally {
        setLoading(false);
      }
    },
    [id, mode]
  );

  const sortedSightings = useMemo(() => {
    const list = Array.isArray(bird?.sightings) ? [...bird.sightings] : [];
    const timeValue = (item) => {
      const t = new Date(item?.date || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    if (sightingSort === 'province') {
      list.sort((a, b) => {
        const pa = String(a?.location?.address?.province || '').trim();
        const pb = String(b?.location?.address?.province || '').trim();
        if (!pa && pb) return 1;
        if (pa && !pb) return -1;
        const provinceCmp = pa.localeCompare(pb, 'zh-CN');
        if (provinceCmp !== 0) return provinceCmp;
        const cityCmp = String(a?.location?.address?.city || '').localeCompare(
          String(b?.location?.address?.city || ''),
          'zh-CN'
        );
        if (cityCmp !== 0) return cityCmp;
        return timeValue(b) - timeValue(a);
      });
      return list;
    }
    list.sort((a, b) => timeValue(b) - timeValue(a));
    return list;
  }, [bird?.sightings, sightingSort]);

  const sightingStats = useMemo(() => {
    const last = sortedSightings[0];
    return {
      count: sortedSightings.length,
      lastDate: last?.date ? formatDisplayDate(last.date, 'short') : '—',
      lastPlace: last?.location?.name || '—',
    };
  }, [sortedSightings]);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const checkFavoriteStatus = async () => {
      const token = localStorage.getItem('token');
      if (token && isMounted) {
        try {
          const data = await api.users.getFavorites();
          if (data.success && isMounted) {
            const favorited = data.data.some((birdItem) => birdItem._id === id);
            setIsFavorited(favorited);
          }
        } catch (favoriteError) {
          if ((favoriteError.status === 401 || favoriteError.status === 503) && isMounted) {
            setIsFavorited(false);
            return;
          }
          console.error('检查收藏状态失败:', favoriteError);
        }
      }
    };

    Promise.all([fetchBirdData(), checkFavoriteStatus()]);

    return () => {
      isMounted = false;
    };
  }, [id, fetchBirdData]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError('');
    setError(null);
    const captionName = bird?.name || '鸟种';
    await uploadFile(file, {
      caption: `${captionName} - ${formatDisplayDate(new Date(), 'short')}`,
      location: '用户上传',
      date: new Date().toISOString(),
    });
    e.target.value = '';
  };

  useEffect(() => {
    if (uploadError) setError(uploadError);
  }, [uploadError]);

  const handleCallUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4a',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/ogg',
      'audio/webm',
    ];
    if (!allowedTypes.includes(file.type) && !/\.(mp3|m4a|wav|ogg|webm)$/i.test(file.name)) {
      setError('请选择 MP3 / M4A / WAV / OGG 音频文件');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('音频大小不能超过 20MB');
      return;
    }

    setUploadingCall(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('caption', `${bird.name} 鸣叫 - ${formatDisplayDate(new Date(), 'short')}`);
      formData.append('location', '用户上传');
      formData.append('date', new Date().toISOString());

      const data = await api.birds.addCall(id, formData);

      if (data.success) {
        const nextCalls = Array.isArray(data.data?.calls)
          ? [...data.data.calls].sort((a, b) => (a.order || 0) - (b.order || 0))
          : [];
        setBird((prevBird) => ({
          ...prevBird,
          ...data.data,
          sightings: prevBird.sightings ?? [],
          calls: nextCalls,
        }));
        notify('鸣叫上传成功', 'success');
      } else {
        setError(data.message || '上传失败');
      }
    } catch {
      setError('上传失败，请重试');
    } finally {
      setUploadingCall(false);
      e.target.value = '';
    }
  };

  const handleFavorite = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('请先登录', 'warning', 3000);
      }
      return;
    }

    setFavoriteLoading(true);
    try {
      const data = isFavorited ? await api.users.removeFavorite(id) : await api.users.addFavorite(id);

      if (data.success) {
        setIsFavorited(!isFavorited);
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(isFavorited ? '🪶 已从收藏中移除' : '🪶 已添加到收藏', 'success', 2500);
        }
      } else if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(data.message || '操作失败', 'error', 3000);
      }
    } catch {
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('操作失败，请重试', 'error', 3000);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setShowImageViewer(true);
  };

  const handleSetMainImage = async (index) => {
    if (index === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        notify('请先登录', 'warning');
        return;
      }

      const data = await api.birds.setMainImage(id, index);

      if (data.success) {
        const nextImages = Array.isArray(data.data?.images)
          ? [...data.data.images].sort((a, b) => (a.order || 0) - (b.order || 0))
          : bird.images;
        setBird((prevBird) => ({
          ...prevBird,
          images: nextImages,
        }));
        notify('主图设置成功', 'success');
      } else {
        notify(data.message || '设置失败');
      }
    } catch (setMainImageError) {
      console.error('设置主图失败:', setMainImageError);
      notify('设置失败，请重试');
    }
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
  };

  const handleSightingImageClick = (sightingIndex, imageIndex, images) => {
    setCurrentSightingImageIndex(imageIndex);
    setCurrentSightingImages(images);
    setShowSightingImageViewer(true);
  };

  const handleCloseSightingImageViewer = () => {
    setShowSightingImageViewer(false);
    setCurrentSightingImages([]);
  };

  const handleEditImage = (image, index) => {
    const token = localStorage.getItem('token');
    if (!token) {
      notify('请先登录才能编辑图片信息', 'warning');
      return;
    }

    setEditingImage({ ...image, index });
    setEditFormData({
      caption: image.caption || '',
      location: image.location || '',
      date: image.date ? formatLocalDateKey(image.date) : todayLocalDateKey(),
      tags: normalizeBirdImageTags(image.tags),
    });
  };

  const toggleEditImageTag = (tagValue) => {
    setEditFormData((prev) => {
      const current = normalizeBirdImageTags(prev.tags);
      const next = current.includes(tagValue)
        ? current.filter((item) => item !== tagValue)
        : [...current, tagValue];
      return { ...prev, tags: next };
    });
  };

  const handleDeleteImage = async (event, index) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const ok = await ask('确定删除这张图片？删除后不能恢复。');
    if (!ok) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        notify('请先登录', 'warning');
        return;
      }

      const data = await api.birds.deleteImage(id, index);

      if (data.success) {
        if (data.data) {
          if (data.data.images && data.data.images.length > 0) {
            data.data.images.sort((a, b) => (a.order || 0) - (b.order || 0));
          }
          setBird((prevBird) => ({
            ...prevBird,
            ...data.data,
            sightings: prevBird.sightings ?? [],
          }));
        } else {
          setBird((prevBird) => ({
            ...prevBird,
            images: prevBird.images.filter((_, i) => i !== index),
          }));
        }
        notify('图片删除成功', 'success');
      } else {
        notify(`删除失败：${data.message || '未知错误'}`);
      }
    } catch (deleteError) {
      console.error('删除图片错误:', deleteError);
      notify(`删除失败：${deleteError.message || '请重试'}`);
    }
  };

  const canManageImage = () => Boolean(user);
  const canManageCall = () => Boolean(user);

  const handleEditCall = (call, index) => {
    const token = localStorage.getItem('token');
    if (!token) {
      notify('请先登录才能编辑鸣叫信息', 'warning');
      return;
    }

    setEditingCall({ ...call, index });
    setEditCallFormData({
      caption: call.caption || '',
      location: call.location || '',
      date: call.date ? formatLocalDateKey(call.date) : todayLocalDateKey(),
      tags: normalizeBirdCallTags(call.tags),
    });
  };

  const toggleEditCallTag = (tagValue) => {
    setEditCallFormData((prev) => {
      const current = normalizeBirdCallTags(prev.tags);
      const next = current.includes(tagValue)
        ? current.filter((item) => item !== tagValue)
        : [...current, tagValue];
      return { ...prev, tags: next };
    });
  };

  const handleDeleteCall = async (event, index) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const ok = await ask('确定删除这条鸣叫？删除后不能恢复。');
    if (!ok) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        notify('请先登录', 'warning');
        return;
      }

      const data = await api.birds.deleteCall(id, index);

      if (data.success) {
        const nextCalls = Array.isArray(data.data?.calls)
          ? [...data.data.calls].sort((a, b) => (a.order || 0) - (b.order || 0))
          : (bird.calls || []).filter((_, i) => i !== index);
        setBird((prevBird) => ({
          ...prevBird,
          ...(data.data || {}),
          sightings: prevBird.sightings ?? [],
          calls: nextCalls,
        }));
        notify('鸣叫删除成功', 'success');
      } else {
        notify(`删除失败：${data.message || '未知错误'}`);
      }
    } catch (deleteError) {
      console.error('删除鸣叫错误:', deleteError);
      notify(`删除失败：${deleteError.message || '请重试'}`);
    }
  };

  const handleSaveCallEdit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        notify('请先登录', 'warning');
        return;
      }

      const updateData = {
        caption: editCallFormData.caption || '',
        location: editCallFormData.location || '',
        date: editCallFormData.date || todayLocalDateKey(),
        tags: normalizeBirdCallTags(editCallFormData.tags),
      };

      const data = await api.birds.updateCall(id, editingCall.index, updateData);

      if (data.success) {
        const nextCalls = Array.isArray(data.data?.calls)
          ? [...data.data.calls].sort((a, b) => (a.order || 0) - (b.order || 0))
          : (bird.calls || []).map((call, index) =>
              index === editingCall.index
                ? { ...call, ...updateData, date: new Date(updateData.date) }
                : call
            );
        setBird((prevBird) => ({
          ...prevBird,
          ...(data.data || {}),
          sightings: prevBird.sightings ?? [],
          calls: nextCalls,
        }));
        setEditingCall(null);
        notify('鸣叫信息已更新', 'success');
      } else {
        notify(data.message || '保存失败');
      }
    } catch (saveError) {
      console.error('保存鸣叫失败:', saveError);
      notify('保存失败，请重试');
    }
  };

  const handleSaveImageEdit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        notify('请先登录', 'warning');
        return;
      }

      const updateData = {
        caption: editFormData.caption || '',
        location: editFormData.location || '',
        date: editFormData.date || todayLocalDateKey(),
        url: editingImage.url,
        tags: normalizeBirdImageTags(editFormData.tags),
      };

      const data = await api.birds.updateImage(id, editingImage.index, updateData);

      if (data.success) {
        setBird((prevBird) => ({
          ...prevBird,
          images: prevBird.images.map((image, index) =>
            index === editingImage.index
              ? { ...image, ...updateData, date: new Date(updateData.date) }
              : image
          ),
        }));
        setEditingImage(null);
        notify('图片信息更新成功', 'success');
      } else {
        console.error('更新失败:', data);
        notify(data.message || '更新失败');
      }
    } catch (saveError) {
      console.error('更新图片信息失败:', saveError);
      notify('更新失败，请重试');
    }
  };

  const handleDeleteBird = async () => {
    if (!bird) return;
    const ok = await ask({
      message: `确定删除「${bird.name}」？\n会一并去掉这只鸟的图片、鸣叫和观察记录。删除后不能恢复。`,
    });
    if (!ok) return;

    try {
      const data = await api.birds.delete(id);

      if (data.success) {
        notify('鸟类记录删除成功', 'success');
        if (router) router.push('/birds');
      } else {
        console.error('删除失败:', data);
        setError(data.message || '删除失败');
      }
    } catch {
      setError('删除失败，请重试');
    }
  };

  const similarCandidateNames = useMemo(
    () => extractSimilarBirdNames(bird?.similarSpecies, bird?.name),
    [bird?.similarSpecies, bird?.name]
  );

  const isCompared = Boolean(bird?._id && isInCompareTray(bird._id));

  const handleToggleCompare = useCallback(() => {
    if (!bird?._id) return;
    const { added } = toggleCompare(bird);
    notify(added ? `已将「${bird.name}」加入对比台` : `已从对比台移除「${bird.name}」`, 'success');
  }, [bird, toggleCompare, notify]);

  const handleCompareWithSimilar = useCallback(async () => {
    if (!bird?._id) return;
    setComparingLoading(true);
    try {
      const currentEntry = {
        _id: String(bird._id),
        name: bird.name,
        scientificName: bird.scientificName || '',
        primaryImage: bird.images?.[0]?.url || '',
      };
      const matchedEntries = [currentEntry];

      for (const candidateName of similarCandidateNames.slice(0, MAX_COMPARE_ITEMS - 1)) {
        try {
          const res = await api.birds.getAll({ search: candidateName, limit: '3' });
          const found = (res?.data || []).find(
            (b) => String(b._id) !== String(bird._id) && (b.name === candidateName || b.name.includes(candidateName))
          );
          if (found && !matchedEntries.some((e) => e._id === String(found._id))) {
            matchedEntries.push({
              _id: String(found._id),
              name: found.name,
              scientificName: found.scientificName || '',
              primaryImage: found.images?.[0]?.url || '',
            });
          }
        } catch {
          // ignore single lookup error
        }
      }

      if (matchedEntries.length === 1 && bird.family) {
        try {
          const res = await api.birds.getAll({ family: bird.family, limit: '4' });
          (res?.data || []).forEach((b) => {
            if (
              String(b._id) !== String(bird._id) &&
              matchedEntries.length < MAX_COMPARE_ITEMS &&
              !matchedEntries.some((e) => e._id === String(b._id))
            ) {
              matchedEntries.push({
                _id: String(b._id),
                name: b.name,
                scientificName: b.scientificName || '',
                primaryImage: b.images?.[0]?.url || '',
              });
            }
          });
        } catch {
          // ignore fallback error
        }
      }

      writeCompareTray(matchedEntries, { openWorkbench: true });
    } finally {
      setComparingLoading(false);
    }
  }, [bird, similarCandidateNames]);

  return {
    user,
    bird,
    loading,
    uploading,
    uploadingCall,
    error,
    editingImage,
    setEditingImage,
    editingCall,
    setEditingCall,
    editFormData,
    setEditFormData,
    editCallFormData,
    setEditCallFormData,
    isFavorited,
    favoriteLoading,
    isCompared,
    comparingLoading,
    similarCandidateNames,
    showImageViewer,
    currentImageIndex,
    showSightingImageViewer,
    currentSightingImageIndex,
    currentSightingImages,
    managingImages,
    setManagingImages,
    compactImages,
    setCompactImages,
    sightingSort,
    setSightingSort,
    detailTab,
    setDetailTab,
    sortedSightings,
    sightingStats,
    confirmDialog,
    handleImageUpload,
    handleCallUpload,
    handleFavorite,
    handleToggleCompare,
    handleCompareWithSimilar,
    handleImageClick,
    handleSetMainImage,
    handleCloseImageViewer,
    handleSightingImageClick,
    handleCloseSightingImageViewer,
    handleEditImage,
    toggleEditImageTag,
    handleDeleteImage,
    canManageImage,
    canManageCall,
    handleEditCall,
    toggleEditCallTag,
    handleDeleteCall,
    handleSaveCallEdit,
    handleSaveImageEdit,
    handleDeleteBird,
  };
}

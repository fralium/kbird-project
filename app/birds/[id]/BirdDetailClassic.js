'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryDisplay from '@/components/CategoryDisplay';
import ImageViewer from '@/components/ImageViewer';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import LazyImage from '@/components/LazyImage';
import PageState from '@/components/PageState';
import FormModal from '@/components/FormModal';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderSecondaryButton,
  HeaderSecondaryLink,
  HeaderTextLink,
} from '@/components/SimplePageHeader';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '@/data/taxonomyTranslation';
import { useAuth } from '@/components/AuthProvider';
import { formatCategory } from '@/utils/formatCategory';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { api } from '@/utils/api';
import { useBirdImageUpload } from '@/hooks/useBirdImageUpload';
import { getFullImageUrl, isValidImageUrl, getImageKey } from '@/utils/imageUtils';
import { formatDisplayDate, formatLocalDateKey, todayLocalDateKey } from '@/utils/localDate';
import { BIRD_IMAGE_TAG_GROUPS, normalizeBirdImageTags } from '@/data/birdImageTags';
import { BIRD_CALL_TAG_GROUPS, normalizeBirdCallTags } from '@/data/birdCallTags';
import {
  getProtectionLevelInfo,
} from '@/data/protectionLevels';
import styles from '@/styles/BirdDetail.module.css';

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

const formatOutingBirds = (sighting, currentName) => {
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

function ProtectionStatusBadges({ bird, className = '' }) {
  const items = [
    bird?.iucnProtectionLevel
      ? { type: 'iucn', level: bird.iucnProtectionLevel, label: `IUCN ${bird.iucnProtectionLevel}` }
      : null,
    bird?.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入'
      ? { type: 'china', level: bird.chinaProtectionLevel, label: `中国 ${bird.chinaProtectionLevel}` }
      : null,
  ].filter(Boolean);

  if (items.length === 0) {
    return <span className={styles.protectionEmpty}>—</span>;
  }

  return (
    <span className={`${styles.protectionBadges} ${className}`.trim()}>
      {items.map((item) => {
        const info = getProtectionLevelInfo(item.type, item.level);
        // 与列表卡一致：IUCN 湖泊青、国保橙，实心胶囊（不用红/紫）
        const color = item.type === 'china' ? '#fd7e14' : '#219EBC';
        return (
          <span
            key={`${item.type}-${item.level}`}
            className={`${styles.protectionBadge} ${styles.protectionBadgeElevated}`}
            style={{ '--badge-color': color }}
            title={info?.description || item.label}
          >
            {item.label}
          </span>
        );
      })}
    </span>
  );
}

export default function BirdDetailClassic() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
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
  const [detailTab, setDetailTab] = useState('info');
  const lastTabBirdId = useRef('');
  const { ask, dialog: confirmDialog } = useConfirmDialog();
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

  const fetchBirdData = useCallback(async (forceRefresh = false) => {
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
          if (birdResponse.images?.length) setDetailTab('images');
          else if (sightings.length) setDetailTab('sightings');
          else if (birdResponse.calls?.length) setDetailTab('calls');
          else setDetailTab('info');
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
  }, [id]);

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
    const ok = await ask({
      message: `确定删除「${bird.name}」？\n会一并去掉这只鸟的图片、鸣叫和观察记录。删除后不能恢复。`,
    });
    if (!ok) return;

    try {
      const data = await api.birds.delete(id);

      if (data.success) {
        notify('鸟类记录删除成功', 'success');
        router.push('/birds');
      } else {
        console.error('删除失败:', data);
        setError(data.message || '删除失败');
      }
    } catch {
      setError('删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="鸟类详情加载中..." message="正在读取物种信息与观察数据。" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!bird) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState
            type="error"
            title="未找到鸟类信息"
            message={error || '该鸟类可能已被删除或不存在。'}
            actionLabel="返回鸟类列表"
            onAction={() => router.push('/birds')}
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
          title={bird.name}
          description={
            [bird.englishName, bird.scientificName].filter(Boolean).join(' · ') || '本机鸟种资料'
          }
          descriptionVariant="caption"
          actions={
            <>
              <HeaderTextLink href="/birds">返回列表</HeaderTextLink>
              {user ? (
                <HeaderSecondaryLink href={`/birds/edit/${id}`}>完善信息</HeaderSecondaryLink>
              ) : null}
              <HeaderPrimaryButton onClick={handleFavorite} disabled={favoriteLoading}>
                {favoriteLoading ? '处理中…' : isFavorited ? '已收藏' : '收藏'}
              </HeaderPrimaryButton>
              {user?.role === 'admin' ? (
                <HeaderSecondaryButton onClick={handleDeleteBird}>删除</HeaderSecondaryButton>
              ) : null}
              <HeaderTextLink href={`/birds/${id}`}>新版</HeaderTextLink>
            </>
          }
        />

        <div className="kb-view-bar" role="tablist" aria-label="鸟种资料">
          <div className="kb-view-seg">
            {[
              { id: 'images', label: `图片 ${bird.images?.length || 0}` },
              { id: 'calls', label: `鸣叫 ${bird.calls?.length || 0}` },
              { id: 'info', label: '基本信息' },
              { id: 'sightings', label: `观察 ${bird.sightings?.length || 0}` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={detailTab === tab.id}
                className={`kb-view-tab${detailTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setDetailTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="kb-view-hint">
            {[
              bird.order
                ? formatTaxonomyDisplay(getOrderChineseName(bird.order), bird.order)
                : null,
              bird.family
                ? formatTaxonomyDisplay(getFamilyChineseName(bird.family), bird.family)
                : formatCategory(bird.category),
              bird.iucnProtectionLevel ? `IUCN ${bird.iucnProtectionLevel}` : null,
              bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入'
                ? `中国${bird.chinaProtectionLevel}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || '本机鸟种卡片'}
          </p>
        </div>

        <div className={styles.scrollPage}>
          {detailTab === 'images' ? (
          <section id="bird-images" className={styles.pageSection}>
            <div className={styles.sectionHeading}>
              <h2>图片</h2>
              <span className={styles.sectionCount}>{bird.images?.length || 0}</span>
              <div className={styles.sectionHeadingActions}>
                {user ? (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="image-upload"
                      disabled={uploading}
                    />
                    <label htmlFor="image-upload" className={styles.uploadQuietButton}>
                      {uploading ? '上传中…' : '+ 上传'}
                    </label>
                    {bird.images?.length ? (
                      <button
                        type="button"
                        className={`${styles.uploadQuietButton} ${managingImages ? styles.manageOn : ''}`}
                        onClick={() => setManagingImages((open) => !open)}
                      >
                        {managingImages ? '完成' : '操作'}
                      </button>
                    ) : null}
                  </>
                ) : null}
                {bird.images?.length ? (
                  <button
                    type="button"
                    className={`${styles.uploadQuietButton} ${compactImages ? styles.manageOn : ''}`}
                    onClick={() => setCompactImages((open) => !open)}
                  >
                    {compactImages ? '大图' : '缩略图'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.imagesTab}>
              {managingImages ? (
                <p className={styles.manageHint}>点照片仍可放大。设主图、编辑、删除在每张照片下面。</p>
              ) : null}
              {bird.images && bird.images.length > 0 ? (
                <div
                  className={`${styles.imageGrid} ${compactImages ? styles.imageGridCompact : ''}`}
                >
                  {bird.images.map((image, index) => (
                    <div
                      key={getImageKey(image.url, index)}
                      className={`${styles.imageItem} ${index === 0 ? styles.imageItemMain : ''} ${
                        managingImages ? styles.imageItemManaging : ''
                      }`}
                    >
                      <div className={styles.imageContainer}>
                        <LazyImage
                          src={getFullImageUrl(image.url)}
                          alt={image.caption || `图片 ${index + 1}`}
                          width={640}
                          height={420}
                          fillContainer
                          objectFit="cover"
                          className={styles.image}
                          onClick={() => handleImageClick(index)}
                          onError={() => {
                            console.error('图片加载失败:', {
                              originalUrl: image.url,
                              fullUrl: getFullImageUrl(image.url),
                              isValid: isValidImageUrl(image.url),
                            });
                          }}
                        />
                        <div className={styles.imageError} style={{ display: 'none' }}>
                          <span>图片加载失败</span>
                        </div>
                      </div>
                      {(index === 0 ||
                        image.caption ||
                        (Array.isArray(image.tags) && image.tags.length > 0)) && (
                      <div className={styles.imageMeta}>
                        <div className={styles.imageMetaTop}>
                          {index === 0 ? <span className={styles.mainFlag}>主图</span> : null}
                          {Array.isArray(image.tags) && image.tags.length > 0 ? (
                            <div className={styles.imageTagRow}>
                              {normalizeBirdImageTags(image.tags).map((tag) => (
                                <span key={tag} className={styles.imageTag}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {image.caption ? <div className={styles.imageCaption}>{image.caption}</div> : null}
                      </div>
                      )}
                      {managingImages && canManageImage() ? (
                        <div className={styles.imageToolbar}>
                          {index > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSetMainImage(index)}
                            >
                              设为主图
                            </button>
                          ) : null}
                          <button type="button" onClick={() => handleEditImage(image, index)}>
                            编辑
                          </button>
                          <button
                            type="button"
                            className={styles.toolbarDanger}
                            onClick={(event) => handleDeleteImage(event, index)}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyImages}>
                  <p>还没有本种照片</p>
                  {user ? (
                    <label htmlFor="image-upload" className={styles.emptyImagesAction}>
                      {uploading ? '上传中…' : '上传第一张照片'}
                    </label>
                  ) : (
                    <span>登录后可上传</span>
                  )}
                </div>
              )}
              {error && <div className={styles.errorMessage}>{error}</div>}
            </div>
          </section>
          ) : null}

          {detailTab === 'calls' ? (
          <section id="bird-calls" className={styles.pageSection}>
            <div className={styles.sectionHeading}>
              <h2>鸣叫</h2>
              <span className={styles.sectionCount}>{bird.calls?.length || 0}</span>
              {user ? (
                <div className={styles.sectionHeadingActions}>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.webm"
                    onChange={handleCallUpload}
                    style={{ display: 'none' }}
                    id="call-upload"
                    disabled={uploadingCall}
                  />
                  <label htmlFor="call-upload" className={styles.uploadQuietButton}>
                    {uploadingCall ? '上传中…' : '+ 上传'}
                  </label>
                </div>
              ) : null}
            </div>

            <div className={styles.callsTab}>
              {bird.calls && bird.calls.length > 0 ? (
                <div className={styles.callList}>
                  {bird.calls.map((call, index) => (
                    <div key={`${call.url}-${index}`} className={styles.callItem}>
                      <div className={styles.callPlayerRow}>
                        <audio
                          className={styles.callAudio}
                          controls
                          preload="metadata"
                          src={getFullImageUrl(call.url)}
                        >
                          您的浏览器不支持音频播放
                        </audio>
                        {canManageCall() ? (
                          <div className={styles.callActions}>
                            <button
                              type="button"
                              className={styles.editButton}
                              onClick={() => handleEditCall(call, index)}
                              title="编辑鸣叫信息"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={(event) => handleDeleteCall(event, index)}
                              title="删除鸣叫"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {(call.caption || (Array.isArray(call.tags) && call.tags.length > 0) || call.location) ? (
                        <div className={styles.callMeta}>
                          {Array.isArray(call.tags) && call.tags.length > 0 ? (
                            <div className={styles.imageTagRow}>
                              {normalizeBirdCallTags(call.tags).map((tag) => (
                                <span key={tag} className={styles.imageTag}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {call.caption ? <div className={styles.imageCaption}>{call.caption}</div> : null}
                          {call.location ? <div className={styles.callLocation}>{call.location}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyImages}>
                  <p>还没有本种鸣叫录音</p>
                  {user ? (
                    <label htmlFor="call-upload" className={styles.emptyImagesAction}>
                      {uploadingCall ? '上传中…' : '上传第一条鸣叫'}
                    </label>
                  ) : (
                    <span>登录后可上传</span>
                  )}
                </div>
              )}
            </div>
          </section>
          ) : null}

          {detailTab === 'info' ? (
          <section id="bird-info" className={styles.pageSection}>
            <div className={styles.sectionHeading}>
              <h2>基本信息</h2>
            </div>

            <div className={styles.infoTab}>
              {bird.description ? (
                <div className={styles.infoSection}>
                  <h3>描述</h3>
                  <p>{bird.description}</p>
                </div>
              ) : null}

              <dl className={styles.infoFacts}>
                <div className={styles.infoFact}>
                  <dt>中文别名</dt>
                  <dd>
                    {Array.isArray(bird.nameAliases) && bird.nameAliases.length > 0
                      ? bird.nameAliases.join('、')
                      : '—'}
                  </dd>
                </div>
                <div className={styles.infoFact}>
                  <dt>栖息地</dt>
                  <dd>{bird.habitat || '—'}</dd>
                </div>
                <div className={styles.infoFact}>
                  <dt>分布区域</dt>
                  <dd>{bird.distribution || '—'}</dd>
                </div>
                <div className={styles.infoFact}>
                  <dt>保护状态</dt>
                  <dd>
                    <ProtectionStatusBadges bird={bird} />
                  </dd>
                </div>
                <div className={styles.infoFact}>
                  <dt>分类</dt>
                  <dd>
                    <CategoryDisplay category={bird.category} variant="inline" bird={bird} />
                  </dd>
                </div>
              </dl>

              {Array.isArray(bird.tags) && bird.tags.length > 0 ? (
                <div className={styles.tagsContainer}>
                  <h3>标签</h3>
                  <div className={styles.tags}>
                    {bird.tags.map((tag, index) => (
                      <span key={index} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
          ) : null}

          {detailTab === 'sightings' ? (
          <section id="bird-sightings" className={styles.pageSection}>
            <div className={styles.sectionHeading}>
              <h2>观察记录</h2>
              <span className={styles.sectionCount}>{bird.sightings?.length || 0}</span>
              <div className={styles.sectionHeadingActions}>
                {bird.sightings?.length ? (
                  <div className="kb-view-seg kb-meta-seg" role="group" aria-label="排序">
                    <button
                      type="button"
                      className={`kb-view-tab kb-meta-tab${sightingSort === 'date' ? ' is-active' : ''}`}
                      onClick={() => setSightingSort('date')}
                    >
                      按时间
                    </button>
                    <button
                      type="button"
                      className={`kb-view-tab kb-meta-tab${sightingSort === 'province' ? ' is-active' : ''}`}
                      onClick={() => setSightingSort('province')}
                    >
                      按省
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.sightingsTab}>
              {sortedSightings.length > 0 ? (
                <div className={styles.sightingsList}>
                  {sortedSightings.map((sighting, index) => {
                    const locationName = sighting?.location?.name || '地点未知';
                    const addressLabel = formatAddressRegion(sighting?.location?.address);
                    const dateLabel = sighting?.date
                      ? formatDisplayDate(sighting.date, 'short')
                      : '日期未知';
                    const images = Array.isArray(sighting.images) ? sighting.images : [];
                    const recordHref = sighting.recordId ? `/records/${sighting.recordId}` : null;
                    const outingBirds = formatOutingBirds(sighting, bird.name);
                    const cardInner = (
                      <>
                        <div className={styles.sightingMain}>
                          <span className={styles.sightingDate}>{dateLabel}</span>
                          <span className={styles.sightingPlace}>
                            <span className={styles.sightingLocation}>{locationName}</span>
                            {addressLabel ? (
                              <span className={styles.sightingLocationAddress}>{addressLabel}</span>
                            ) : null}
                          </span>
                          {outingBirds ? (
                            <span
                              className={styles.sightingBirds}
                              title={`${outingBirds.shown.join('、')}${
                                outingBirds.overflow ? ` 等共 ${outingBirds.total} 种` : ` 共 ${outingBirds.total} 种`
                              }`}
                            >
                              {outingBirds.shown.join(' · ')}
                              <span className={styles.sightingBirdCount}> 共{outingBirds.total}种</span>
                            </span>
                          ) : (
                            <span className={styles.sightingBirds} />
                          )}
                          {recordHref ? (
                            <span className={styles.sightingChevron} aria-hidden="true">
                              →
                            </span>
                          ) : null}
                        </div>
                        {sighting.notes ? <p className={styles.sightingNotes}>{sighting.notes}</p> : null}
                        {images.length > 0 ? (
                          <div className={styles.sightingImages}>
                            {images.slice(0, 3).map((image, imgIndex) => (
                              <div
                                key={imgIndex}
                                className={styles.sightingImageContainer}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleSightingImageClick(index, imgIndex, images);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleSightingImageClick(index, imgIndex, images);
                                  }
                                }}
                              >
                                {image.url ? (
                                  <Image
                                    src={image.url}
                                    alt={image.caption || '观察记录图片'}
                                    width={120}
                                    height={80}
                                    unoptimized={!String(image.url).startsWith('/')}
                                    className={styles.sightingImage}
                                  />
                                ) : (
                                  <div className={styles.sightingImagePlaceholder}>
                                    <div className={styles.placeholderText}>图</div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {images.length > 3 ? (
                              <span className={styles.moreImages}>+{images.length - 3}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    );

                    return recordHref ? (
                      <Link
                        key={sighting._id || sighting.recordId || index}
                        href={recordHref}
                        className={styles.sightingCard}
                      >
                        {cardInner}
                      </Link>
                    ) : (
                      <div key={sighting._id || index} className={styles.sightingCard}>
                        {cardInner}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <PageState
                  type="empty"
                  title="还没有本种的观察记录"
                  message="记一笔后，这里会按日期列出出现过的地点。"
                  actionLabel={user ? '去记一笔' : undefined}
                  onAction={
                    user
                      ? () => {
                          if (typeof window !== 'undefined') {
                            window.location.assign(
                              `/records/add?birdId=${encodeURIComponent(id)}&birdName=${encodeURIComponent(bird.name || '')}`
                            );
                          }
                        }
                      : undefined
                  }
                />
              )}
            </div>
          </section>
          ) : null}
        </div>
      </main>

      <FormModal
        open={Boolean(editingImage)}
        title="编辑图片信息"
        onClose={() => setEditingImage(null)}
        actions={
          <>
            <button type="button" onClick={() => setEditingImage(null)}>
              取消
            </button>
            <button type="submit" form="bird-edit-image-form">
              保存
            </button>
          </>
        }
      >
        <form id="bird-edit-image-form" onSubmit={(e) => handleSaveImageEdit(e)}>
          <div className={styles.formGroup}>
            <label>图片标题</label>
            <input
              type="text"
              value={editFormData.caption}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, caption: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>拍摄地点</label>
            <LocationAutocomplete
              value={editFormData.location}
              onChange={(value) => setEditFormData((prev) => ({ ...prev, location: value }))}
              placeholder="搜索或选择观鸟地点..."
            />
          </div>
          <div className={styles.formGroup}>
            <label>拍摄日期</label>
            <input
              type="date"
              value={editFormData.date || ''}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>图片标签</label>
            <div className={styles.tagEditor}>
              {BIRD_IMAGE_TAG_GROUPS.map((group) => (
                <div key={group.id} className={styles.tagEditorGroup}>
                  <div className={styles.tagEditorGroupLabel}>{group.label}</div>
                  <div className={styles.tagEditorOptions}>
                    {group.options.map((option) => {
                      const selected = normalizeBirdImageTags(editFormData.tags).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.tagChip} ${selected ? styles.tagChipSelected : ''}`}
                          onClick={() => toggleEditImageTag(option.value)}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(editingCall)}
        title="编辑鸣叫信息"
        onClose={() => setEditingCall(null)}
        actions={
          <>
            <button type="button" onClick={() => setEditingCall(null)}>
              取消
            </button>
            <button type="submit" form="bird-edit-call-form">
              保存
            </button>
          </>
        }
      >
        <form id="bird-edit-call-form" onSubmit={handleSaveCallEdit}>
          <div className={styles.formGroup}>
            <label>标题</label>
            <input
              type="text"
              value={editCallFormData.caption}
              onChange={(e) => setEditCallFormData((prev) => ({ ...prev, caption: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>录制地点</label>
            <LocationAutocomplete
              value={editCallFormData.location}
              onChange={(value) => setEditCallFormData((prev) => ({ ...prev, location: value }))}
              placeholder="搜索或选择观鸟地点..."
            />
          </div>
          <div className={styles.formGroup}>
            <label>录制日期</label>
            <input
              type="date"
              value={editCallFormData.date || ''}
              onChange={(e) => setEditCallFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>鸣叫标签</label>
            <div className={styles.tagEditor}>
              {BIRD_CALL_TAG_GROUPS.map((group) => (
                <div key={group.id} className={styles.tagEditorGroup}>
                  <div className={styles.tagEditorGroupLabel}>{group.label}</div>
                  <div className={styles.tagEditorOptions}>
                    {group.options.map((option) => {
                      const selected = normalizeBirdCallTags(editCallFormData.tags).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.tagChip} ${selected ? styles.tagChipSelected : ''}`}
                          onClick={() => toggleEditCallTag(option.value)}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </FormModal>

      {showImageViewer && bird.images && (
        <ImageViewer images={bird.images} currentIndex={currentImageIndex} onClose={handleCloseImageViewer} />
      )}

      {showSightingImageViewer && currentSightingImages && (
        <ImageViewer
          images={currentSightingImages}
          currentIndex={currentSightingImageIndex}
          onClose={handleCloseSightingImageViewer}
        />
      )}

      {confirmDialog}

      <Footer />
    </div>
  );
}

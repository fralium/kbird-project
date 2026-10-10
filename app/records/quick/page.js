'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useAuth } from '../../../components/AuthProvider';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import BirdNameAutocomplete from '../../../components/BirdNameAutocomplete';
import PageState from '../../../components/PageState';
import SimplePageHeader from '../../../components/SimplePageHeader';
import { useConfirmDialog } from '../../../components/ConfirmDialog';
import { api } from '../../../utils/api';
import { extractLngLatPair } from '../../../utils/locationCoords';
import { todayLocalDateKey } from '../../../utils/localDate';
import styles from '../../../styles/QuickRecord.module.css';

const QUICK_RECORD_DRAFT_KEY = 'kbird.quickRecord.draft';
const QUICK_RECORD_LAST_LOCATION_KEY = 'kbird.quickRecord.lastLocation';

export default function QuickRecordPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [recentLocations, setRecentLocations] = useState([]);
  const hasFetchedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  const routerPushRef = useRef(router.push);
  useEffect(() => {
    routerPushRef.current = router.push;
  }, [router.push]);

  const userId = useMemo(() => user?.id?.toString() || user?._id?.toString() || null, [user?.id, user?._id]);

  const [formData, setFormData] = useState({
    date: todayLocalDateKey(),
    location: { name: '', coordinates: [0, 0] },
    birds: [{ name: '', count: 1 }],
    notes: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(QUICK_RECORD_LAST_LOCATION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed?.name) return;
      setFormData((prev) => {
        if (prev.location?.name) return prev;
        return {
          ...prev,
          location: {
            name: parsed.name,
            coordinates: parsed.coordinates || [0, 0],
          },
        };
      });
    } catch {
      // ignore local cache parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawDraft = localStorage.getItem(QUICK_RECORD_DRAFT_KEY);
      if (!rawDraft) return;
      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;
      if (!Array.isArray(parsedDraft.birds) || parsedDraft.birds.length === 0) return;
      if (!parsedDraft.location?.name) return;
      setFormData((prev) => ({
        ...prev,
        ...parsedDraft,
      }));
      setMessage('已恢复上次未提交草稿');
    } catch {
      // ignore corrupted draft data
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        QUICK_RECORD_DRAFT_KEY,
        JSON.stringify({
          date: formData.date,
          location: formData.location,
          birds: formData.birds,
          notes: formData.notes,
        })
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [formData]);

  useEffect(() => {
    if (authLoading) return;

    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!userId || !hasToken) {
      if (!hasToken && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        routerPushRef.current('/login?redirect=/records/quick');
      }
      return;
    }

    if (userId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchRecentLocations();
    }
  }, [authLoading, userId]);

  const resolveLocationCoords = async (locationName) => {
    const name = String(locationName || '').trim();
    if (!name) return null;
    try {
      const data = await api.locations.getByName(name);
      if (!data?.success || !data.data) return null;
      return extractLngLatPair(data.data);
    } catch {
      return null;
    }
  };

  const fetchRecentLocations = async () => {
    try {
      if (!userId) return;

      const data = await api.records.getByUser(userId, { limit: '50' });
      if (data.success && data.data) {
        const locations = [...new Set(data.data.map((r) => r.location.name).filter(Boolean))].slice(0, 5);
        setRecentLocations(locations);
        if (locations.length > 0) {
          setFormData((prev) => {
            if (prev.location?.name) return prev;
            return {
              ...prev,
              location: {
                name: locations[0],
                coordinates: [0, 0],
              },
            };
          });
          // 异步补全默认地点坐标，避免误存 [0,0]
          resolveLocationCoords(locations[0]).then((coords) => {
            if (!coords) return;
            setFormData((prev) => {
              if (prev.location?.name !== locations[0]) return prev;
              const existing = extractLngLatPair(prev.location);
              if (existing) return prev;
              return {
                ...prev,
                location: { ...prev.location, coordinates: coords },
              };
            });
          });
        }
      }
    } catch (error) {
      console.error('获取最近地点失败:', error);
    }
  };

  const handleLocationSelect = (location) => {
    const coords = extractLngLatPair(location);
    const normalizedLocation = {
      name: typeof location === 'string' ? location : location?.name || '',
      coordinates: coords || [0, 0],
      address: location?.address || {},
    };
    setFormData((prev) => ({
      ...prev,
      location: normalizedLocation,
    }));
    if (typeof window !== 'undefined' && normalizedLocation.name) {
      localStorage.setItem(QUICK_RECORD_LAST_LOCATION_KEY, JSON.stringify(normalizedLocation));
    }
  };

  const handleQuickLocationSelect = async (locationName) => {
    const name = String(locationName || '').trim();
    if (!name) return;
    const requestToken = `${name}:${Date.now()}`;
    setFormData((prev) => ({
      ...prev,
      location: {
        name,
        coordinates: [0, 0],
        _resolveToken: requestToken,
      },
    }));
    const coords = await resolveLocationCoords(name);
    const normalizedLocation = {
      name,
      coordinates: coords || [0, 0],
    };
    setFormData((prev) => {
      // 若用户已改选其他地点，丢弃过期解析结果
      if (prev.location?.name !== name) return prev;
      if (prev.location?._resolveToken && prev.location._resolveToken !== requestToken) {
        return prev;
      }
      return {
        ...prev,
        location: normalizedLocation,
      };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUICK_RECORD_LAST_LOCATION_KEY, JSON.stringify(normalizedLocation));
    }
    if (!coords) {
      setMessage(`「${name}」在地点词典中暂无有效坐标，请从下拉选择带坐标的地点或先补全坐标`);
    }
  };

  const handleBirdNameChange = (index, value) => {
    setFormData((prev) => {
      const newBirds = [...prev.birds];
      newBirds[index] = { ...newBirds[index], name: value };
      return { ...prev, birds: newBirds };
    });
  };

  const handleBirdSelect = (index, bird) => {
    setFormData((prev) => {
      const newBirds = [...prev.birds];
      newBirds[index] = {
        ...newBirds[index],
        name: bird.name,
        birdId: bird._id,
      };
      return { ...prev, birds: newBirds };
    });
  };

  const handleBirdCountChange = (index, value) => {
    setFormData((prev) => {
      const newBirds = [...prev.birds];
      newBirds[index] = { ...newBirds[index], count: parseInt(value, 10) || 1 };
      return { ...prev, birds: newBirds };
    });
  };

  const addBird = () => {
    setFormData((prev) => ({
      ...prev,
      birds: [...prev.birds, { name: '', count: 1 }],
    }));
  };

  const focusBirdInput = (index) => {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      const input = document.querySelector(`[data-quick-bird-input="${index}"] input`);
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    }, 0);
  };

  const handleBirdEnter = (index, event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const currentBird = formData.birds[index];
    if (!currentBird?.name?.trim()) return;
    if (index === formData.birds.length - 1) {
      addBird();
      focusBirdInput(index + 1);
      return;
    }
    focusBirdInput(index + 1);
  };

  const removeBird = async (index) => {
    if (formData.birds.length <= 1) return;
    const ok = await ask('从这条记录里去掉这只鸟？');
    if (!ok) return;
    setFormData((prev) => ({
      ...prev,
      birds: prev.birds.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!formData.location.name) {
      setMessage('请选择观察地点');
      setLoading(false);
      return;
    }

    if (formData.birds.some((bird) => !bird.name.trim())) {
      setMessage('请填写所有鸟类的名称');
      setLoading(false);
      return;
    }

    if (!userId) {
      setMessage('用户未登录，请重新登录');
      setLoading(false);
      router.push('/login');
      return;
    }

    try {
      const processedBirds = [];
      const birdErrors = [];

      for (const bird of formData.birds) {
        if (!bird.name || !bird.name.trim()) {
          birdErrors.push('请填写所有鸟类的名称');
          continue;
        }

        if (bird.birdId) {
          processedBirds.push({
            birdId: bird.birdId,
            count: bird.count || 1,
            notes: '',
          });
          continue;
        }

        try {
          const searchData = await api.birds.getAll({
            search: bird.name.trim(),
            limit: '1',
          });

          if (searchData.success && Array.isArray(searchData.data) && searchData.data.length > 0) {
            processedBirds.push({
              birdId: searchData.data[0]._id,
              count: bird.count || 1,
              notes: '',
            });
          } else {
            birdErrors.push(`未找到鸟类: ${bird.name}`);
          }
        } catch (error) {
          console.error(`搜索鸟类 "${bird.name}" 失败:`, error);
          birdErrors.push(`搜索鸟类 "${bird.name}" 时发生错误`);
        }
      }

      if (birdErrors.length > 0) {
        setMessage(`以下鸟类无法找到：\n${birdErrors.join('\n')}`);
        setLoading(false);
        return;
      }

      if (processedBirds.length === 0) {
        setMessage('请至少填写一个有效的鸟类名称');
        setLoading(false);
        return;
      }

      const observerId = user?._id || user?.id || userId;

      const rawCoordinates = formData.location?.coordinates;
      const normalizedCoordinates = Array.isArray(rawCoordinates)
        ? rawCoordinates
        : rawCoordinates?.coordinates || null;
      const lng = Number(normalizedCoordinates?.[0]);
      const lat = Number(normalizedCoordinates?.[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
        setMessage('请先从地点词典选择带坐标的地点，或补全有效经纬度后再提交');
        setLoading(false);
        return;
      }
      const recordLocation = {
        name: formData.location.name,
        coordinates: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      };

      const recordData = {
        title: `${formData.location.name}观鸟记录`,
        location: recordLocation,
        date: formData.date,
        observer: observerId,
        notes: formData.notes || '',
        birds: processedBirds,
        status: 'published',
      };

      const data = await api.records.create(recordData);

      if (data.success) {
        setMessage('记录创建成功！正在跳转到记录列表...');
        setFormData({
          date: todayLocalDateKey(),
          location: {
            name: formData.location.name || '',
            coordinates: formData.location.coordinates || [0, 0],
          },
          birds: [{ name: '', count: 1 }],
          notes: '',
        });
        if (typeof window !== 'undefined' && formData.location?.name) {
          localStorage.setItem(QUICK_RECORD_LAST_LOCATION_KEY, JSON.stringify(formData.location));
          localStorage.removeItem(QUICK_RECORD_DRAFT_KEY);
        }
        setTimeout(() => {
          router.push('/records');
        }, 1200);
      } else {
        console.error('创建失败:', data);
        setMessage(`创建失败：${data.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('创建记录失败:', error);
      setMessage(`创建失败：${error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="正在检查登录状态..." />
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
          title="快速记录"
          description="先记再补全"
          descriptionVariant="caption"
        />

        {message && (
          <div className={`${styles.message} ${message.includes('成功') ? styles.success : styles.error}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.formSection} aria-labelledby="quick-when-where">
            <h2 id="quick-when-where" className={styles.sectionTitle}>
              何时何地
            </h2>

            <div className={styles.metaRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="quick-date">
                  <span className={styles.required}>*</span>
                  观察日期
                </label>
                <input
                  id="quick-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.required}>*</span>
                观察地点
              </label>
              <LocationAutocomplete
                onChange={handleLocationSelect}
                value={formData.location}
                className={styles.locationInput}
              />

              {recentLocations.length > 0 && (
                <div className={styles.recentLocations}>
                  <span className={styles.recentLabel}>最近使用</span>
                  {recentLocations.map((loc, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleQuickLocationSelect(loc)}
                      className={styles.recentLocationButton}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={styles.formSection} aria-labelledby="quick-birds">
            <h2 id="quick-birds" className={styles.sectionTitle}>
              鸟种清单
            </h2>
            <p className={styles.quickHint}>在鸟名框按回车可跳到下一行并自动新增。</p>
            {formData.birds.map((bird, index) => (
              <div key={index} className={styles.birdRow}>
                <BirdNameAutocomplete
                  containerProps={{ 'data-quick-bird-input': index }}
                  value={bird.name}
                  onChange={(value) => handleBirdNameChange(index, value)}
                  onSelect={(selectedBird) => handleBirdSelect(index, selectedBird)}
                  onInputKeyDown={(event) => handleBirdEnter(index, event)}
                  placeholder="鸟名，如：麻雀"
                  className={styles.birdNameInput}
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={bird.count}
                  onChange={(e) => handleBirdCountChange(index, e.target.value)}
                  className={styles.birdCountInput}
                  aria-label={`第 ${index + 1} 种数量`}
                />
                <span className={styles.birdCountLabel}>只</span>
                {formData.birds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBird(index)}
                    className={styles.removeButton}
                    aria-label={`移除第 ${index + 1} 种`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addBird} className={styles.addBirdButton}>
              + 添加鸟种
            </button>
          </section>

          <section className={styles.formSection} aria-labelledby="quick-notes">
            <h2 id="quick-notes" className={styles.sectionTitle}>
              备注
              <span className={styles.optionalTag}>可选</span>
            </h2>
            <div className={styles.formGroup}>
              <label className={styles.srOnly} htmlFor="quick-notes-input">
                备注
              </label>
              <textarea
                id="quick-notes-input"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className={styles.textarea}
                rows="3"
                placeholder="天气、生境、同行人等可后补…"
              />
            </div>
          </section>

          <div className={styles.formActions}>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? '提交中...' : '快速提交'}
            </button>
            <button
              type="button"
              className={styles.detailLink}
              onClick={() => {
                router.push('/records/add');
              }}
            >
              需要天气、照片等字段？用详细记录 →
            </button>
          </div>
        </form>
      </main>

      <Footer />
      {confirmDialog}
    </div>
  );
}

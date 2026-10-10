'use client';
import { useState, useEffect, useMemo } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import HabitatGallery from '../../../components/HabitatGallery';
import { useAuth } from '../../../components/AuthProvider';
import { api } from '../../../utils/api';
import { formatAddressRegion } from '../../../utils/formatAddressRegion';
import { getFullImageUrl, isValidImageUrl } from '../../../utils/imageUtils';
import { getOrderChineseName, getFamilyChineseName } from '../../../data/taxonomyTranslation';
import { buildLocationBirdCalendar } from '../../../utils/locationBirdCalendar';
import SimplePageHeader, {
  HeaderPrimaryLink,
  HeaderTextLink,
} from '../../../components/SimplePageHeader';
import SpeciesHoverChip from '../../../components/SpeciesHoverChip';
import styles from '../../../styles/LocationDetail.module.css';

function formatTaxonomyLabel(latinName, getChineseName) {
  const latin = String(latinName || '').trim();
  if (!latin) return '未分类';
  const chinese = getChineseName(latin);
  if (!chinese || chinese === latin) return latin;
  return `${chinese} (${latin})`;
}

const AUTO_IMPORT_LOCATION_NOTE =
  '由数据导入时自动建立，可在地点名录中补充类型、描述等信息。';

function isAutoImportLocationNote(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return (
    value === AUTO_IMPORT_LOCATION_NOTE ||
    (value.includes('自动建立') && value.includes('地点名录'))
  );
}

export default function LocationDetailPage() {
  const params = useParams();
  const id = params?.id;
  const { user, token } = useAuth();
  const isAuthenticated = !!token && !!user;

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [sightings, setSightings] = useState([]);
  const [locationRecords, setLocationRecords] = useState([]);
  const [activeStatPanel, setActiveStatPanel] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [canManage, setCanManage] = useState(false);
  const [habitatBusy, setHabitatBusy] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);

  useEffect(() => {
    if (!id) return;
    fetchLocationDetail();
  }, [id, isAuthenticated, user]);

  const fetchLocationDetail = async () => {
    try {
      const data = await api.locations.getById(id);
      if (data.success) {
        setLocation(data.data);
        await fetchLocationSightings(data.data.name);
      } else {
        setError(data.message || '获取地点详情失败');
      }
    } catch (fetchError) {
      console.error('获取地点详情失败:', fetchError);
      setError('获取地点详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationSightings = async (locationName) => {
    try {
      const allRecords = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const data = await api.records.getAll({
          location: locationName,
          page: String(page),
          limit: '100',
        });
        if (!data.success) break;

        allRecords.push(...(data.data || []));
        totalPages = data.pagination?.totalPages || 1;
        page += 1;
      }

      const convertedSightings = [];
      allRecords.forEach((record) => {
        (record.birds || []).forEach((bird) => {
          if (!bird?.birdId?._id) return;
          convertedSightings.push({
            _id: `${record._id}_${bird.birdId._id}`,
            bird: {
              _id: bird.birdId._id,
              name: bird.birdId.name,
              scientificName: bird.birdId.scientificName,
              images: bird.birdId.images || [],
            },
            location: {
              name: record.location?.name,
              _id: record.location?._id,
            },
            date: record.date,
            observer: {
              name: record.observer?.name,
              _id: record.observer?._id,
            },
            count: Number(bird.count) > 0 ? Number(bird.count) : 1,
            notes: bird.notes || '',
            images: bird.images || [],
          });
        });
      });

      setLocationRecords(allRecords);
      setSightings(convertedSightings);
    } catch (fetchError) {
      console.error('获取观鸟记录失败:', fetchError);
    }
  };

  useEffect(() => {
    if (!Array.isArray(sightings) || sightings.length === 0) return;
    const grouped = groupSightingsByDate(sightings);
    const dates = Object.keys(grouped);
    setExpandedDates((prev) => {
      const next = { ...prev };
      dates.forEach((date) => {
        if (typeof next[date] === 'undefined') {
          next[date] = false;
        }
      });
      return next;
    });
  }, [sightings]);

  const groupSightingsByDate = (items) => {
    const grouped = {};
    (items || []).forEach((sighting) => {
      const parsed = sighting?.date ? new Date(sighting.date) : null;
      const date =
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString().split('T')[0]
          : '未知日期';
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(sighting);
    });
    return grouped;
  };

  const formatDateParts = (dateString) => {
    if (!dateString || dateString === '未知日期') {
      return { dayText: '未知日期', weekdayText: '' };
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return { dayText: '未知日期', weekdayText: '' };
    }
    return {
      dayText: date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      weekdayText: date.toLocaleDateString('zh-CN', {
        weekday: 'short',
      }),
    };
  };

  const getSightingPreviewImageUrl = (sighting) => {
    const recordImage = Array.isArray(sighting.images) ? sighting.images[0] : null;
    const recordImageUrl = recordImage && typeof recordImage === 'object' ? recordImage.url : recordImage;
    if (recordImageUrl && isValidImageUrl(recordImageUrl)) return getFullImageUrl(recordImageUrl);

    const birdImage = Array.isArray(sighting.bird?.images) ? sighting.bird.images[0] : null;
    const birdImageUrl = birdImage && typeof birdImage === 'object' ? birdImage.url : birdImage;
    if (birdImageUrl && isValidImageUrl(birdImageUrl)) return getFullImageUrl(birdImageUrl);
    return '';
  };

  const buildDateSummaryRows = (dateSightings) => {
    const map = new Map();
    (dateSightings || []).forEach((sighting) => {
      const birdId = sighting?.bird?._id ? String(sighting.bird._id) : '';
      if (!birdId) return;
      if (!map.has(birdId)) {
        map.set(birdId, {
          _id: birdId,
          name: sighting.bird?.name || '未知鸟种',
          scientificName: sighting.bird?.scientificName || '',
          totalCount: 0,
          previewImageUrl: '',
        });
      }
      const item = map.get(birdId);
      item.totalCount += Number(sighting.count) > 0 ? Number(sighting.count) : 1;
      const previewUrl = getSightingPreviewImageUrl(sighting);
      if (!item.previewImageUrl && previewUrl) {
        item.previewImageUrl = previewUrl;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      setCanManage(false);
      return;
    }

    let localUser = null;
    try {
      localUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      localUser = null;
    }
    const hasToken = !!localStorage.getItem('token') || !!token;
    const createdById =
      location?.createdBy?._id?.toString?.() ?? location?.createdBy?.toString?.() ?? '';
    const currentUserId =
      user?.id?.toString?.() ??
      user?._id?.toString?.() ??
      localUser?.id?.toString?.() ??
      localUser?._id?.toString?.() ??
      '';
    const isAdmin = (user?.role || localUser?.role) === 'admin';
    const isCreator = !!createdById && !!currentUserId && createdById === currentUserId;
    const hasOwnerInfo = !!createdById;
    setCanManage(!!((isAuthenticated || hasToken) && (isAdmin || isCreator || !hasOwnerInfo)));
  }, [location, user, token, isAuthenticated]);

  const handleHabitatUpload = async (file) => {
    if (!id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const uploaded = await api.upload.image(file);
      const url = uploaded?.data?.url;
      if (!uploaded?.success || !url) {
        throw new Error(uploaded?.message || '上传失败');
      }
      const data = await api.locations.addImage(id, { url });
      if (!data.success) {
        throw new Error(data.message || '添加到生境库失败');
      }
      setLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatDelete = async (imageIndex) => {
    if (!id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.deleteImage(id, imageIndex);
      if (!data.success) {
        throw new Error(data.message || '删除失败');
      }
      setLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatSetCover = async (imageIndex) => {
    if (!id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.setMainImage(id, imageIndex);
      if (!data.success) {
        throw new Error(data.message || '设置封面失败');
      }
      setLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const handleHabitatUpdateCaption = async (imageIndex, caption) => {
    if (!id || habitatBusy) return;
    setHabitatBusy(true);
    try {
      const data = await api.locations.updateImage(id, imageIndex, { caption });
      if (!data.success) {
        throw new Error(data.message || '保存说明失败');
      }
      setLocation(data.data);
    } finally {
      setHabitatBusy(false);
    }
  };

  const birdCalendar = useMemo(
    () => buildLocationBirdCalendar(locationRecords),
    [locationRecords]
  );
  const selectedCalendarMonth =
    birdCalendar.months.find((m) => m.month === calendarMonth) || birdCalendar.months[0];

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>正在加载地点详情...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.error}>
          <h1>地点不存在</h1>
          <p>{error || '该地点不存在或已被删除'}</p>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点词典
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const groupedSightings = groupSightingsByDate(sightings);
  const sortedDates = Object.keys(groupedSightings).sort((a, b) => new Date(b) - new Date(a));
  const hotspotStats = location.hotspotStats;
  const hasRecentHotspotActivity = Boolean(
    hotspotStats &&
      ((hotspotStats.recent7DaysSpecies || 0) > 0 ||
        (hotspotStats.recent30DaysSpecies || 0) > 0 ||
        (hotspotStats.newSpeciesThisMonth || 0) > 0 ||
        (Array.isArray(hotspotStats.topRecentSpecies) && hotspotStats.topRecentSpecies.length > 0))
  );
  const lastObservedLabel = hotspotStats?.lastObservedAt
    ? new Date(hotspotStats.lastObservedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  const sortedRecordList = (locationRecords || [])
    .map((record) => ({
      _id: record._id,
      title: record.title || `${record.location?.name || '观鸟'}观鸟记录`,
      date: record.date,
      birdCount: Array.isArray(record.birds) ? record.birds.length : 0,
      observerName: record.observer?.name || '未知',
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const groupedRecordListByYear = (() => {
    const yearMap = new Map();
    sortedRecordList.forEach((item) => {
      const year = item.date ? new Date(item.date).getFullYear() : '未知年份';
      if (!yearMap.has(year)) {
        yearMap.set(year, []);
      }
      yearMap.get(year).push(item);
    });

    return Array.from(yearMap.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, records]) => ({ year, records }));
  })();

  const sortedSpeciesList = (() => {
    const speciesMap = new Map();
    (locationRecords || []).forEach((record) => {
      (record.birds || []).forEach((item) => {
        const bird = item?.birdId;
        if (!bird || !bird._id) return;
        const key = String(bird._id);
        if (!speciesMap.has(key)) {
          speciesMap.set(key, {
            _id: key,
            name: bird.name || '未知鸟种',
            scientificName: bird.scientificName || '',
            records: 0,
            order: bird.order || '',
            family: bird.family || '',
          });
        }
        speciesMap.get(key).records += 1;
      });
    });
    return Array.from(speciesMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  })();

  const groupedSpeciesList = (() => {
    const orderMap = new Map();
    sortedSpeciesList.forEach((item) => {
      const orderName = String(item.order || '未分类目').trim() || '未分类目';
      const familyName = String(item.family || '未分类科').trim() || '未分类科';

      if (!orderMap.has(orderName)) {
        orderMap.set(orderName, new Map());
      }
      const familyMap = orderMap.get(orderName);
      if (!familyMap.has(familyName)) {
        familyMap.set(familyName, []);
      }
      familyMap.get(familyName).push(item);
    });

    return Array.from(orderMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
      .map(([orderName, familyMap]) => ({
        orderName,
        families: Array.from(familyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
          .map(([familyName, species]) => ({
            familyName,
            species: species.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
          })),
      }));
  })();

  const locationDescription = String(location.description || '').trim();
  const autoImportNote = isAutoImportLocationNote(locationDescription);

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.content}>
        <SimplePageHeader
          title={location.name}
          description={[
            location.type || '地点',
            formatAddressRegion(location.address) || '地址未完善',
          ].join(' · ')}
          descriptionVariant="caption"
          actions={
            <>
              <HeaderTextLink href="/locations">返回名录</HeaderTextLink>
              {canManage ? (
                <HeaderPrimaryLink href={`/locations/edit/${id}`}>编辑地点</HeaderPrimaryLink>
              ) : null}
            </>
          }
        />
        {actionMessage && (
          <p className={styles.errorMessage} style={{ marginTop: '8px' }}>
            {actionMessage}
          </p>
        )}

        <div className={styles.summaryStrip}>
          <button
            type="button"
            className={`${styles.summaryItem} ${activeStatPanel === 'records' ? styles.summaryItemActive : ''}`}
            onClick={() => setActiveStatPanel((prev) => (prev === 'records' ? null : 'records'))}
          >
            <span className={styles.summaryValue}>
              {Number.isFinite(location.stats?.totalRecords) ? location.stats.totalRecords : '—'}
            </span>
            <span className={styles.summaryLabel}>观察次数</span>
          </button>
          <button
            type="button"
            className={`${styles.summaryItem} ${activeStatPanel === 'species' ? styles.summaryItemActive : ''}`}
            onClick={() => setActiveStatPanel((prev) => (prev === 'species' ? null : 'species'))}
          >
            <span className={styles.summaryValue}>
              {Number.isFinite(location.stats?.uniqueSpecies) ? location.stats.uniqueSpecies : '—'}
            </span>
            <span className={styles.summaryLabel}>鸟类种类</span>
          </button>
          <div className={styles.summaryItemStatic}>
            <span className={styles.summaryValue}>{lastObservedLabel || '—'}</span>
            <span className={styles.summaryLabel}>最近观察</span>
          </div>
        </div>

        <section className={styles.introSection} aria-label="地点介绍">
          <div className={styles.introHeader}>
            <h2 className={styles.introTitle}>介绍</h2>
            {canManage ? (
              <Link href={`/locations/edit/${id}`} className={styles.introEdit}>
                编辑
              </Link>
            ) : null}
          </div>
          {locationDescription && !autoImportNote ? (
            <p className={styles.introBody}>{locationDescription}</p>
          ) : (
            <p className={styles.introEmpty}>
              还没有介绍。
              {canManage ? ' 可在编辑里写范围、生境和观鸟要点。' : ''}
            </p>
          )}
        </section>

        <div className={styles.habitatBlock}>
          <HabitatGallery
            title="生境图"
            images={location.images || []}
            currentLocationId={location._id}
            linkCaptions={false}
            canUpload={isAuthenticated || !!token}
            canDelete={canManage}
            onUpload={handleHabitatUpload}
            onDelete={handleHabitatDelete}
            onSetCover={canManage ? handleHabitatSetCover : undefined}
            onUpdateCaption={canManage ? handleHabitatUpdateCaption : undefined}
            hint="上传此地点的环境照片，供所有观鸟记录共用。观鸟证据照仍放在各条观察记录里。第一张为封面。"
            emptyText="还没有生境照片，登录后可上传湿地、林缘、滩涂等环境图"
          />
        </div>

        <section className={styles.calendarSection} aria-label="地点鸟历">
          <div className={styles.calendarHeader}>
            <h2 className={styles.calendarTitle}>地点鸟历</h2>
            <p className={styles.calendarHint}>
              根据此地历史观鸟记录汇总（不依赖外部数据）。有记录的月份
              {birdCalendar.activeMonthCount} 个
              {birdCalendar.lastVisit
                ? ` · 最近观察 ${birdCalendar.lastVisit.toLocaleDateString('zh-CN')}`
                : ''}
            </p>
          </div>
          {birdCalendar.activeMonthCount === 0 ? (
            <p className={styles.calendarEmpty}>暂无记录，添加观鸟记录后将自动生成月度鸟历</p>
          ) : (
            <>
              <div className={styles.calendarGrid}>
                {birdCalendar.months.map((month) => {
                  const isActive = month.month === calendarMonth;
                  const hasData = month.recordCount > 0;
                  const isCurrent = month.month === birdCalendar.currentMonth;
                  return (
                    <button
                      key={month.month}
                      type="button"
                      className={`${styles.calendarCell} ${hasData ? styles.calendarCellHasData : ''} ${
                        isActive ? styles.calendarCellActive : ''
                      } ${isCurrent ? styles.calendarCellCurrent : ''}`}
                      onClick={() => setCalendarMonth(month.month)}
                      disabled={!hasData}
                    >
                      <span className={styles.calendarMonthLabel}>{month.label}</span>
                      <span className={styles.calendarMonthValue}>
                        {hasData ? `${month.speciesCount} 种` : '—'}
                      </span>
                      <span className={styles.calendarMonthSub}>
                        {hasData ? `${month.visitDays} 天 · ${month.recordCount} 次` : '无记录'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.calendarDetail}>
                <h3>
                  {selectedCalendarMonth.label}
                  {selectedCalendarMonth.month === birdCalendar.currentMonth ? '（本月）' : ''}
                  ：{selectedCalendarMonth.speciesCount} 种 · {selectedCalendarMonth.visitDays} 个观察日
                </h3>
                {selectedCalendarMonth.topSpecies.length === 0 ? (
                  <p className={styles.calendarEmpty}>该月暂无鸟种记录</p>
                ) : (
                  <div className={styles.calendarSpecies}>
                    {selectedCalendarMonth.topSpecies.map((bird) => (
                      <SpeciesHoverChip
                        key={bird.id}
                        name={bird.name}
                        href={`/birds/${bird.id}`}
                        className={styles.calendarSpeciesChip}
                      >
                        {bird.name}
                        <span>
                          {bird.records} 次 · ×{bird.count}
                        </span>
                      </SpeciesHoverChip>
                    ))}
                    {selectedCalendarMonth.speciesCount > selectedCalendarMonth.topSpecies.length ? (
                      <span className={styles.calendarMore}>
                        另有 {selectedCalendarMonth.speciesCount - selectedCalendarMonth.topSpecies.length} 种
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {hasRecentHotspotActivity && (
          <div className={styles.hotspotStrip}>
            <span className={styles.hotspotTitle}>近期热点</span>
            <div className={styles.hotspotMetrics}>
              {(hotspotStats.recent7DaysSpecies || 0) > 0 && (
                <span>近7天 {hotspotStats.recent7DaysSpecies} 种</span>
              )}
              {(hotspotStats.recent30DaysSpecies || 0) > 0 && (
                <span>近30天 {hotspotStats.recent30DaysSpecies} 种</span>
              )}
              {(hotspotStats.newSpeciesThisMonth || 0) > 0 && (
                <span>本月新增 {hotspotStats.newSpeciesThisMonth} 种</span>
              )}
            </div>
            {Array.isArray(hotspotStats.topRecentSpecies) && hotspotStats.topRecentSpecies.length > 0 && (
              <div className={styles.hotspotSpecies}>
                {hotspotStats.topRecentSpecies.slice(0, 6).map((item) => (
                  <SpeciesHoverChip
                    key={item._id}
                    name={item.name || '未知鸟种'}
                    href={`/birds/${item._id}`}
                    className={styles.hotspotChip}
                  >
                    {item.name || '未知鸟种'}
                    {item.count ? ` · ${item.count}` : ''}
                  </SpeciesHoverChip>
                ))}
              </div>
            )}
          </div>
        )}

        {activeStatPanel && (
          <div className={styles.statPanel}>
            <div className={styles.statPanelHeader}>
              <h3>{activeStatPanel === 'records' ? `记录列表（${sortedRecordList.length}）` : `鸟种列表（${sortedSpeciesList.length}）`}</h3>
              <button type="button" className={styles.closePanelButton} onClick={() => setActiveStatPanel(null)}>
                收起
              </button>
            </div>
            {activeStatPanel === 'records' ? (
              <div className={styles.taxonomyPanel}>
                {groupedRecordListByYear.map((yearGroup) => (
                  <div key={yearGroup.year} className={styles.orderBlock}>
                    <h4 className={styles.orderTitle}>{yearGroup.year}年（{yearGroup.records.length}记录）</h4>
                    <div className={styles.speciesGrid}>
                      {yearGroup.records.map((item) => (
                        <Link key={item._id} href={`/records/${item._id}`} className={styles.speciesItem}>
                          <span className={styles.panelMainText}>{item.title}</span>
                          <span className={styles.panelMetaText}>
                            {new Date(item.date).toLocaleDateString('zh-CN')} · {item.birdCount} 种
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.taxonomyPanel}>
                {groupedSpeciesList.map((orderGroup) => (
                  <div key={orderGroup.orderName} className={styles.orderBlock}>
                    <h4 className={styles.orderTitle}>
                      {formatTaxonomyLabel(orderGroup.orderName, getOrderChineseName)}
                    </h4>
                    {orderGroup.families.map((familyGroup) => (
                      <div key={`${orderGroup.orderName}-${familyGroup.familyName}`} className={styles.familyBlock}>
                        <div className={styles.familyTitle}>
                          {formatTaxonomyLabel(familyGroup.familyName, getFamilyChineseName)}
                        </div>
                        <div className={styles.speciesGrid}>
                          {familyGroup.species.map((item) => (
                            <Link key={item._id} href={`/birds/${item._id}`} className={styles.speciesItem}>
                              <span className={styles.panelMainText}>{item.name}</span>
                              <span className={styles.panelMetaText}>
                                {item.scientificName || '无学名'} · {item.records} 次
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.sightingsSection}>
          <div className={styles.sightingsHeader}>
            <h2>观察记录</h2>
            <p>点日期展开鸟种表</p>
          </div>
          {sightings.length > 0 ? (
            <div className={styles.timeline}>
              {sortedDates.map((date) => {
                const dateSightings = groupedSightings[date] || [];
                const summaryRows = buildDateSummaryRows(dateSightings);
                const isExpanded = expandedDates[date] === true;
                return (
                  <div key={date} className={styles.timelineItem}>
                    <div className={styles.timelineDate}>
                      <button
                        type="button"
                        className={styles.dateToggleButton}
                        onClick={() => setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }))}
                      >
                        <div className={styles.dateContent}>
                          <span className={styles.dateText}>{formatDateParts(date).dayText}</span>
                          <span className={styles.dateWeekday}>{formatDateParts(date).weekdayText}</span>
                          <span className={styles.toggleHint}>
                            {isExpanded ? '收起' : '展开'}
                          </span>
                        </div>
                      </button>
                    </div>

                    <div className={styles.timelineContent}>
                      {isExpanded ? (
                        <div className={styles.summaryTableWrap}>
                          <table className={styles.summaryTable}>
                            <thead>
                              <tr>
                                <th>图片</th>
                                <th>鸟种</th>
                                <th>拉丁名</th>
                                <th>数量</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryRows.map((item) => (
                                <tr key={item._id}>
                                  <td>
                                    {item.previewImageUrl ? (
                                      <Image
                                        src={item.previewImageUrl}
                                        alt={item.name}
                                        width={84}
                                        height={60}
                                        unoptimized
                                        className={styles.summaryThumb}
                                      />
                                    ) : (
                                      <span className={styles.summaryNoImage}>—</span>
                                    )}
                                  </td>
                                  <td>
                                    <SpeciesHoverChip
                                      name={item.name}
                                      href={`/birds/${item._id}`}
                                      className={styles.summaryBirdLink}
                                    />
                                  </td>
                                  <td className={styles.summaryScientific}>{item.scientificName || '—'}</td>
                                  <td>{item.totalCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className={styles.basicIntroCard}>
                          <div className={styles.basicIntroList}>
                            {summaryRows.slice(0, 10).map((item) => (
                              <SpeciesHoverChip
                                key={item._id}
                                name={item.name}
                                href={`/birds/${item._id}`}
                                className={styles.basicIntroChip}
                              />
                            ))}
                            <span className={styles.basicIntroMore}>
                              共{summaryRows.length}种
                              {summaryRows.length > 10 ? ' · 点日期看全表' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.noSightings}>
              <p>该地点暂无观察记录</p>
              <Link href="/records/add" className={styles.addSightingButton}>
                添加观察记录
              </Link>
            </div>
          )}
        </div>

        <div className={styles.backSection}>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点词典
          </Link>
        </div>
        {autoImportNote ? (
          <p className={styles.importNote}>备注：{AUTO_IMPORT_LOCATION_NOTE}</p>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

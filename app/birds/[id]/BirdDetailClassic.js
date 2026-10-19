'use client';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryDisplay from '@/components/CategoryDisplay';
import PageState from '@/components/PageState';
import SimplePageHeader, {
  HeaderPrimaryButton,
  HeaderSecondaryButton,
  HeaderSecondaryLink,
  HeaderTextLink,
} from '@/components/SimplePageHeader';
import { getOrderChineseName, getFamilyChineseName, formatTaxonomyDisplay } from '@/data/taxonomyTranslation';
import { formatCategory } from '@/utils/formatCategory';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { formatDisplayDate } from '@/utils/localDate';
import { useBirdDetailController, formatOutingBirds } from '@/hooks/useBirdDetailController';
import {
  ProtectionStatusBadges,
  BirdImagesSection,
  BirdCallsSection,
  BirdDetailMediaModals,
} from '@/components/BirdDetailShared';
import PhenologyMonthBar from '@/components/PhenologyMonthBar';
import TaxonCompareDrawer from '@/components/TaxonCompareDrawer';
import styles from '@/styles/BirdDetail.module.css';

export default function BirdDetailClassic() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const controller = useBirdDetailController(id, { mode: 'classic', router });
  const {
    user,
    bird,
    loading,
    error,
    isFavorited,
    favoriteLoading,
    isCompared,
    comparingLoading,
    sightingSort,
    setSightingSort,
    detailTab,
    setDetailTab,
    sortedSightings,
    handleFavorite,
    handleToggleCompare,
    handleCompareWithSimilar,
    handleSightingImageClick,
    handleDeleteBird,
  } = controller;

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
              <HeaderSecondaryButton onClick={handleCompareWithSimilar} disabled={comparingLoading}>
                {comparingLoading ? '加载对比…' : '相似种对比'}
              </HeaderSecondaryButton>
              <HeaderSecondaryButton onClick={handleToggleCompare}>
                {isCompared ? '已在对比台' : '+ 对比'}
              </HeaderSecondaryButton>
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
          {detailTab === 'images' ? <BirdImagesSection controller={controller} /> : null}

          {detailTab === 'calls' ? <BirdCallsSection controller={controller} /> : null}

          {detailTab === 'info' ? (
            <section id="bird-info" className={styles.pageSection}>
              <div className={styles.sectionHeading}>
                <h2>基本信息</h2>
              </div>

              <div className={styles.infoTab}>
                <PhenologyMonthBar
                  sightings={bird.sightings || []}
                  images={bird.images || []}
                  migrationText={bird.migration || ''}
                />
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

      <BirdDetailMediaModals controller={controller} />
      <TaxonCompareDrawer />

      <Footer />
    </div>
  );
}

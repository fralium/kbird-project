'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryDisplay from '@/components/CategoryDisplay';
import PageState from '@/components/PageState';
import SimplePageHeader, {
  HeaderSecondaryButton,
  HeaderSecondaryLink,
  HeaderTextLink,
} from '@/components/SimplePageHeader';
import { CameraIcon, InfoIcon, LocationIcon } from '@/components/Icons';
import { getOrderChineseName, getFamilyChineseName } from '@/data/taxonomyTranslation';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { getFullImageUrl } from '@/utils/imageUtils';
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
import lab from '@/styles/BirdDetailLab.module.css';

const DETAIL_TABS = [
  { id: 'plate', label: '图鉴', hint: '一眼摘要：辨识要点与关键事实。' },
  { id: 'info', label: '详情', hint: '完整档案：外形、习性、分布与资料。' },
  { id: 'media', label: '影像', hint: '全部参考图与鸣叫。' },
  { id: 'trail', label: '足迹', hint: '按次列出地点和同行鸟种。' },
];

function normalizePlateText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function finishPlateClip(chunk, original) {
  if (!chunk) return '';
  if (chunk === original || /[。！？…]$/.test(chunk)) return chunk;
  return `${chunk.replace(/[，、；;：:\s]+$/u, '')}…`;
}

function plateOneLiner(text, maxChars = 36) {
  const t = normalizePlateText(text);
  if (!t) return '';
  if (t.length <= maxChars) return t;

  const first = (t.match(/^[\s\S]*?[。！？；;]/) || [t])[0].trim();
  if (first.length <= maxChars) return first;

  const clause = first.split(/[，,]/)[0].trim();
  if (clause && clause.length >= 6 && clause.length <= maxChars) {
    return finishPlateClip(clause, t);
  }
  return finishPlateClip(first.slice(0, maxChars), t);
}

function plateListBrief(text, maxItems = 4, maxChars = 40) {
  const t = normalizePlateText(text);
  if (!t) return '';
  const parts = t
    .split(/[、；;，,/／|]/)
    .map((s) => s.replace(/^(繁殖于|越冬于|见于|栖于|喜|多见于)/, '').replace(/[。.！？?]+$/g, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 14);
  if (parts.length >= 2) {
    let out = '';
    for (const p of parts) {
      if (out && out.split('、').length >= maxItems) break;
      const next = out ? `${out}、${p}` : p;
      if (next.length > maxChars) break;
      out = next;
    }
    if (out) return out;
  }
  return plateOneLiner(t, maxChars);
}

function plateMigrationBrief(text) {
  const t = normalizePlateText(text);
  if (!t) return '';
  const status = t.match(/旅鸟|夏候鸟|冬候鸟|留鸟|候鸟|迷鸟/)?.[0] || '';
  if (!status) return plateOneLiner(t, 28);
  const rest = plateOneLiner(t.replace(status, '').replace(/^[，,、：:\s]+/, ''), 20);
  return rest ? `${status}，${rest}` : status;
}

function plateChinaBrief(text) {
  const t = normalizePlateText(text);
  if (!t) return '';
  const sentences = t
    .split(/(?<=[。！？；;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const china =
    sentences.find((s) => /中国|国内|省|自治区|香港|澳门|台湾/.test(s)) ||
    sentences[0] ||
    t;
  return plateOneLiner(china, 40);
}

function plateAliases(bird) {
  const main = String(bird?.name || '').trim();
  const fromField = Array.isArray(bird?.nameAliases)
    ? bird.nameAliases.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const fromBlurb = [];
  const blurb = String(bird?.description || bird?.identificationTips || '');
  const m = blurb.match(/[（(]\s*别名\s*[:：]\s*([^）)]+)[）)]/);
  if (m?.[1]) {
    m[1]
      .split(/[、，,;/／|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((alias) => fromBlurb.push(alias));
  }
  const seen = new Set();
  return [...fromField, ...fromBlurb].filter((alias) => {
    if (!alias || alias === main || seen.has(alias)) return false;
    seen.add(alias);
    return true;
  });
}

function plateGlance(bird) {
  const body = plateOneLiner(
    bird?.identificationTips || bird?.description || bird?.plumage || bird?.size,
    48
  );
  const lead = body.length > 52 ? finishPlateClip(body.slice(0, 52), body) : body;

  const facts = [];
  const mig = plateMigrationBrief(bird?.migration);
  if (mig) facts.push({ label: '迁徙', value: mig, wide: true });
  const hab = plateListBrief(bird?.habitat, 4, 40);
  if (hab) facts.push({ label: '生境', value: hab, wide: true });
  const china = plateChinaBrief(bird?.distribution);
  if (china) facts.push({ label: '国内', value: china, wide: true });

  return { lead, facts, aliases: plateAliases(bird) };
}

function infoFactRows(bird) {
  const aliasText = plateAliases(bird).join('、');
  const rows = [
    ['中文别名', aliasText],
    ['体型大小', bird?.size],
    ['体重', bird?.weight],
    ['翼展', bird?.wingspan],
    ['羽色特征', bird?.plumage],
    ['喙', bird?.bill],
    ['腿脚', bird?.legs],
    ['识别要点', bird?.identificationTips],
    ['相似物种', bird?.similarSpecies],
    ['行为习性', bird?.behavior],
    ['食性', bird?.diet],
    ['迁徙', bird?.migration],
    ['繁殖季节', bird?.breedingSeason],
    ['巢型', bird?.nestType],
    ['窝卵数', bird?.clutchSize],
    ['栖息地', bird?.habitat],
    ['分布区域', bird?.distribution],
    ['参考资料', bird?.references],
  ];
  return rows
    .map(([label, value]) => [label, String(value || '').trim()])
    .filter(([, value]) => value);
}

function formatIucnShort(level) {
  return String(level || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function BirdDetailNotebook() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const controller = useBirdDetailController(id, { mode: 'notebook', router });
  const {
    user,
    bird,
    loading,
    error,
    isFavorited,
    favoriteLoading,
    isCompared,
    comparingLoading,
    similarCandidateNames,
    sightingSort,
    setSightingSort,
    detailTab,
    setDetailTab,
    sortedSightings,
    sightingStats,
    handleFavorite,
    handleToggleCompare,
    handleCompareWithSimilar,
    handleImageClick,
  } = controller;

  const fieldMarks = useMemo(
    () =>
      String(bird?.description || '')
        .split(/[。！？\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3),
    [bird?.description]
  );

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
              <div className="kb-view-seg" role="tablist" aria-label="鸟种资料">
                {DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === tab.id}
                    title={tab.hint}
                    className={`kb-view-tab${detailTab === tab.id ? ' is-active' : ''}`}
                    onClick={() => setDetailTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <HeaderTextLink href="/birds">返回列表</HeaderTextLink>
              {user?.role === 'admin' ? (
                <HeaderSecondaryLink href={`/birds/edit/${id}`}>编辑</HeaderSecondaryLink>
              ) : null}
              <HeaderSecondaryButton
                onClick={handleCompareWithSimilar}
                disabled={comparingLoading}
                title={
                  similarCandidateNames.length
                    ? `一键与相似种（${similarCandidateNames.join('、')}）同屏对比`
                    : '与同科近缘鸟种同屏对比'
                }
              >
                {comparingLoading ? '加载对比…' : '相似种对比'}
              </HeaderSecondaryButton>
              <HeaderSecondaryButton onClick={handleToggleCompare}>
                {isCompared ? '已在对比台' : '+ 对比'}
              </HeaderSecondaryButton>
              <HeaderSecondaryButton onClick={handleFavorite} disabled={favoriteLoading}>
                {favoriteLoading ? '处理中…' : isFavorited ? '已收藏' : '收藏'}
              </HeaderSecondaryButton>
            </>
          }
        />

        <div className={styles.scrollPage}>
          {detailTab === 'plate' ? (
            <section id="bird-plate" className={`${styles.pageSection} ${styles.plateStage}`}>
              {(() => {
                const src = bird.images?.[0]?.url ? getFullImageUrl(bird.images[0].url) : '';
                const glance = plateGlance(bird);
                const copy = (
                  <div className={lab.plateFacts}>
                    <div className={lab.plateLead}>
                      <div className={lab.plateHead}>
                        <div className={lab.plateCatalog}>
                          {bird.name ? <p className={lab.plateName}>{bird.name}</p> : null}
                          {bird.scientificName ? (
                            <p className={lab.plateLatin} data-scientific>
                              {bird.scientificName}
                            </p>
                          ) : null}
                          {bird.englishName ? (
                            <p className={lab.plateEnglish}>{bird.englishName}</p>
                          ) : null}
                          {glance.aliases?.length ? (
                            <p className={lab.plateAliases}>
                              <span className={lab.plateAliasLabel}>别名</span>
                              {glance.aliases.join('、')}
                            </p>
                          ) : null}
                          {bird.order || bird.family ? (
                            <p className={lab.plateTaxa}>
                              {[
                                bird.order ? getOrderChineseName(bird.order) : null,
                                bird.family ? getFamilyChineseName(bird.family) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>
                        {bird.iucnProtectionLevel ||
                        (bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入') ? (
                          <div className={lab.platePills}>
                            {bird.iucnProtectionLevel ? (
                              <span className={lab.platePill} title={`IUCN ${bird.iucnProtectionLevel}`}>
                                <i className={lab.plateDot} aria-hidden="true" />
                                IUCN {formatIucnShort(bird.iucnProtectionLevel)}
                              </span>
                            ) : null}
                            {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' ? (
                              <span className={`${lab.platePill} ${lab.platePillChina}`}>
                                <i className={lab.plateDot} aria-hidden="true" />
                                中国 {bird.chinaProtectionLevel}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {glance.lead || glance.facts.length ? (
                      <div className={lab.plateBody}>
                        {glance.lead ? <p className={lab.plateLeadText}>{glance.lead}</p> : null}
                        {glance.facts.length ? (
                          <dl className={lab.plateGlance}>
                            {glance.facts.map(({ label, value }) => (
                              <div key={label} className={lab.plateGlanceRow}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    ) : null}
                    <div className={lab.plateJump}>
                      <p className={lab.plateJumpLabel}>继续了解</p>
                      <ul className={lab.jumpInCopy}>
                        <li>
                          <button type="button" onClick={() => setDetailTab('info')}>
                            <InfoIcon size={20} color="#023047" />
                            <strong>详情</strong>
                            <span>完整档案</span>
                          </button>
                        </li>
                        <li>
                          <button type="button" onClick={() => setDetailTab('media')}>
                            <CameraIcon size={20} color="#023047" />
                            <strong>影像</strong>
                            <span>{bird.images?.length ? `${bird.images.length} 张` : '还没有'}</span>
                          </button>
                        </li>
                        <li>
                          <button type="button" onClick={() => setDetailTab('trail')}>
                            <LocationIcon size={20} color="#023047" />
                            <strong>足迹</strong>
                            <span>{sightingStats.count ? `${sightingStats.count} 次` : '还没有'}</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                );
                const photo = src ? (
                  <button
                    type="button"
                    className={lab.plateHero}
                    onClick={() => handleImageClick(0)}
                    aria-label="查看主图"
                  >
                    <Image src={src} alt={bird.name} fill unoptimized className={lab.cover} />
                  </button>
                ) : (
                  <div className={lab.plateHero}>
                    <div className={lab.noPhoto}>无图</div>
                  </div>
                );
                return (
                  <div className={lab.plate}>
                    {photo}
                    <div className={lab.plateCopy}>
                      {copy}
                      <PhenologyMonthBar
                        sightings={bird.sightings || []}
                        images={bird.images || []}
                        migrationText={bird.migration || ''}
                      />
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : null}

          {detailTab === 'media' ? (
            <>
              <BirdImagesSection
                controller={controller}
                beforeGrid={
                  fieldMarks.length ? (
                    <ul className={lab.marks}>
                      {fieldMarks.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null
                }
              />
              <BirdCallsSection controller={controller} />
            </>
          ) : null}

          {detailTab === 'info' ? (
            <section id="bird-info" className={styles.pageSection}>
              <div className={styles.sectionHeading}>
                <h2>物种档案</h2>
              </div>

              <div className={styles.infoTab}>
                {bird.description ? (
                  <div className={styles.infoSection}>
                    <h3>概述</h3>
                    <p>{bird.description}</p>
                  </div>
                ) : null}

                <dl className={styles.infoFacts}>
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
                  {infoFactRows(bird).map(([label, value]) => (
                    <div key={label} className={styles.infoFact}>
                      <dt>{label}</dt>
                      <dd style={{ whiteSpace: 'pre-wrap' }}>{value}</dd>
                    </div>
                  ))}
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

          {detailTab === 'trail' ? (
            <section id="bird-sightings" className={styles.pageSection}>
              <div className={styles.sectionHeading}>
                <h2>足迹</h2>
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

              <ol className={lab.trailLine}>
                {sortedSightings.length ? (
                  sortedSightings.map((sighting, index) => {
                    const locationName = sighting?.location?.name || '地点未知';
                    const dateLabel = sighting?.date
                      ? formatDisplayDate(sighting.date, 'short')
                      : '—';
                    const regionLabel = formatAddressRegion(sighting?.location?.address);
                    const recordHref = sighting.recordId ? `/records/${sighting.recordId}` : '';
                    const outingBirds = formatOutingBirds(sighting, bird.name);
                    const birdsTitle = outingBirds
                      ? `${outingBirds.shown.join('、')}${
                          outingBirds.overflow
                            ? ` 等共 ${outingBirds.total} 种`
                            : ` 共 ${outingBirds.total} 种`
                        }`
                      : '';
                    const body = (
                      <>
                        <span className={lab.trailPlace}>
                          <strong>{locationName}</strong>
                          <span className={lab.trailMeta}>
                            {dateLabel}
                            {regionLabel ? ` · ${regionLabel}` : ''}
                            {Array.isArray(sighting.behaviorTags) && sighting.behaviorTags.length > 0
                              ? ` · ${sighting.behaviorTags.join('/')}`
                              : ''}
                          </span>
                        </span>
                        {outingBirds ? (
                          <span className={lab.trailBirds} title={birdsTitle}>
                            <span className={lab.trailBirdNames}>{outingBirds.shown.join(' · ')}</span>
                            <span className={lab.trailBirdCount}>共{outingBirds.total}种</span>
                          </span>
                        ) : (
                          <span className={lab.trailBirds} />
                        )}
                      </>
                    );
                    return (
                      <li key={sighting._id || sighting.recordId || index}>
                        <span className={lab.dot} aria-hidden="true" />
                        {recordHref ? (
                          <Link href={recordHref} className={lab.trailBody}>
                            {body}
                          </Link>
                        ) : (
                          <span className={lab.trailBody}>{body}</span>
                        )}
                      </li>
                    );
                  })
                ) : (
                  <li>
                    <span className={lab.dot} aria-hidden="true" />
                    <span className={lab.muted}>还没有足迹。记一笔后，这里会按次列出地点和同行鸟种。</span>
                  </li>
                )}
              </ol>
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

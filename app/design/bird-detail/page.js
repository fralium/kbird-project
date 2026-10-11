'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { api } from '@/utils/api';
import { getFullImageUrl } from '@/utils/imageUtils';
import { formatAddressRegion } from '@/utils/formatAddressRegion';
import { formatTaxonomyDisplay, getFamilyChineseName, getOrderChineseName } from '@/data/taxonomyTranslation';
import { getProtectionLevelInfo } from '@/data/protectionLevels';
import { normalizeBirdImageTags } from '@/data/birdImageTags';
import { CameraIcon, InfoIcon, LocationIcon } from '@/components/Icons';
import { formatDisplayDate } from '@/utils/localDate';
import styles from '@/styles/BirdDetailLab.module.css';

const DEFAULT_ID = '68db6eba5fa3c9cec50de5ec';

const PAGE_TABS = [
  { id: 'plate', name: '图鉴', hint: '总览。这一页只做摘要。' },
  { id: 'info', name: '详情', hint: '物种说明：外形、生境、分布、保护。' },
  { id: 'media', name: '影像', hint: '全部参考图、外形要点、鸣叫。' },
  { id: 'trail', name: '足迹', hint: '按次列出地点和同行鸟种。' },
];

function fmtDate(value) {
  return formatDisplayDate(value, 'short');
}

function plateBriefRows(bird) {
  const rows = [];
  const aliases = Array.isArray(bird?.nameAliases)
    ? bird.nameAliases.filter(Boolean).join('、')
    : String(bird?.nameAliases || '').trim();
  if (aliases) rows.push(['别名', aliases]);
  const desc = String(bird?.description || '').trim();
  if (desc) rows.push(['描述', desc]);
  const habitat = String(bird?.habitat || '').trim();
  if (habitat) rows.push(['栖息地', habitat]);
  const dist = String(bird?.distribution || '').trim();
  if (dist) rows.push(['分布', dist]);
  const morph = [bird?.size, bird?.plumage, bird?.bill, bird?.legs, bird?.identificationTips]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (morph.length) {
    const look = morph.join('。');
    if (look !== desc) rows.push(['外形', look]);
  }
  return rows;
}

function plateTagList(bird) {
  return Array.isArray(bird?.tags) ? bird.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [];
}

function formatIucnShort(level) {
  return String(level || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function photoUrl(image) {
  const raw = typeof image === 'string' ? image : image?.url;
  return raw ? getFullImageUrl(raw) : '';
}

function placeName(sighting) {
  return sighting?.location?.name || '地点未知';
}

function regionLabel(sighting) {
  return formatAddressRegion(sighting?.location?.address);
}

function fieldMarks(bird) {
  return String(bird?.description || '')
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function ProtectionPills({ bird }) {
  const items = [
    bird?.iucnProtectionLevel
      ? { key: 'iucn', label: `IUCN ${bird.iucnProtectionLevel}`, color: 'var(--color-lake)'}
      : null,
    bird?.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入'
      ? { key: 'china', label: bird.chinaProtectionLevel, color: '#fd7e14'}
      : null,
  ].filter(Boolean);
  if (!items.length) return <span className={styles.muted}>保护 —</span>;
  return (
    <span className={styles.pills}>
      {items.map((item) => (
        <span key={item.key} className={styles.pill} style={{ '--pill': item.color }}>
          {item.label}
        </span>
      ))}
    </span>
  );
}

function SpeciesSci({ bird }) {
  if (!bird?.scientificName) return null;
  return (
    <p className={styles.sci} data-scientific>
      {bird.scientificName}
    </p>
  );
}

function SpeciesMeta({ bird }) {
  const bits = [
    bird.order ? formatTaxonomyDisplay(getOrderChineseName(bird.order), bird.order) : null,
    bird.family
      ? formatTaxonomyDisplay(getFamilyChineseName(bird.family), bird.family)
      : null,
  ].filter(Boolean);
  return bits.length ? <p className={styles.metaLine}>{bits.join(' · ')}</p> : null;
}

function MyStats({ stats }) {
  return (
    <dl className={styles.stats}>
      <div>
        <dt>见过</dt>
        <dd>{stats.count ? `${stats.count} 次` : '还没有'}</dd>
      </div>
      <div>
        <dt>最近</dt>
        <dd>{stats.lastDate}</dd>
      </div>
      <div>
        <dt>地点</dt>
        <dd>{stats.lastPlace}</dd>
      </div>
    </dl>
  );
}

function LabActions({ bird, id }) {
  return (
    <div className={styles.actions}>
      <Link className="btn btn-primary" href={`/birds/${id}`}>
        打开正式详情
      </Link>
      <Link className="btn btn-secondary" href={`/birds/${id}?layout=classic`}>
        旧版排版
      </Link>
    </div>
  );
}

function Filmstrip({ images, active, onPick }) {
  if (!images.length) return <div className={styles.emptyFilm}>还没有图</div>;
  return (
    <div className={styles.film} role="list">
      {images.map((image, index) => {
        const src = photoUrl(image);
        if (!src) return null;
        return (
          <button
            key={`${src}-${index}`}
            type="button"
            className={`${styles.filmItem}${index === active ? ` ${styles.filmOn}` : ''}`}
            onClick={() => onPick(index)}
            aria-label={`图 ${index + 1}`}
          >
            <Image src={src} alt="" width={88} height={66} unoptimized />
          </button>
        );
      })}
    </div>
  );
}

function CallBar({ calls }) {
  const first = calls[0];
  if (!first?.url) {
    return <p className={styles.muted}>还没有鸣叫录音。</p>;
  }
  return (
    <div className={styles.callBar}>
      <span>鸣叫</span>
      <audio controls src={getFullImageUrl(first.url)} preload="none">
        浏览器不能播这段录音
      </audio>
      {calls.length > 1 ? <span className={styles.muted}>另有 {calls.length - 1} 段</span> : null}
    </div>
  );
}

function Identity({ bird }) {
  return (
    <div className={styles.ident}>
      <h2 className={styles.species}>{bird.name}</h2>
      <SpeciesSci bird={bird} />
    </div>
  );
}

function PlateSummary({ bird, stats, images, photo, jumpLinks }) {
  const src = photoUrl(images[photo]);
  const briefRows = plateBriefRows(bird);
  const tagList = plateTagList(bird);
  const body = (
    <>
      <div className={styles.plateFacts}>
        <div className={styles.plateLead}>
        <div className={styles.plateHead}>
          <div className={styles.plateCatalog}>
            {bird.name ? <p className={styles.plateName}>{bird.name}</p> : null}
            {bird.scientificName ? (
              <p className={styles.plateLatin} data-scientific>
                {bird.scientificName}
              </p>
            ) : null}
            {bird.order || bird.family ? (
              <p className={styles.plateTaxa}>
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
            <div className={styles.platePills}>
              {bird.iucnProtectionLevel ? (
                <span className={styles.platePill} title={`IUCN ${bird.iucnProtectionLevel}`}>
                  <i className={styles.plateDot} aria-hidden="true" />
                  IUCN {formatIucnShort(bird.iucnProtectionLevel)}
                </span>
              ) : null}
              {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' ? (
                <span className={`${styles.platePill} ${styles.platePillChina}`}>
                  <i className={styles.plateDot} aria-hidden="true" />
                  中国 {bird.chinaProtectionLevel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
        {briefRows.length || tagList.length ? (
          <div className={styles.plateBody}>
            {briefRows.length ? (
              <dl className={styles.plateBrief}>
                {briefRows.map(([label, value]) => (
                  <div key={label} className={styles.plateBriefRow}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {tagList.length ? (
              <div className={styles.plateTagBlock}>
                <p className={styles.plateBlockLabel}>标签</p>
                <ul className={styles.plateTags} aria-label="标签">
                  {tagList.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {jumpLinks}
      </div>
    </>
  );
  const frame = src ? (
    <div className={styles.plateHero}>
      <Image src={src} alt={bird.name} fill unoptimized className={styles.cover} />
    </div>
  ) : (
    <div className={styles.plateHero}>
      <div className={styles.noPhoto}>无图</div>
    </div>
  );
  return (
    <div className={styles.plate}>
      {frame}
      <div className={styles.plateCopy}>{body}</div>
    </div>
  );
}

function TabPlate({ bird, id, stats, images, photo, onOpen }) {
  return (
    <div>
      <PlateSummary
        bird={bird}
        stats={stats}
        images={images}
        photo={photo}
        jumpLinks={
          <ul className={styles.jumpInCopy}>
            <li>
              <button type="button" onClick={() => onOpen('info')}>
                <InfoIcon size={22} color="#023047" />
                <strong>详情</strong>
                <span>外形与分布</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('media')}>
                <CameraIcon size={22} color="#023047" />
                <strong>影像</strong>
                <span>{images.length ? `${images.length} 张` : '还没有'}</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onOpen('trail')}>
                <LocationIcon size={22} color="#023047" />
                <strong>足迹</strong>
                <span>{stats.count ? `${stats.count} 次` : '还没有'}</span>
              </button>
            </li>
          </ul>
        }
      />
      <LabActions bird={bird} id={id} />
    </div>
  );
}

function TabInfo({ bird }) {
  const iucn = getProtectionLevelInfo('iucn', bird.iucnProtectionLevel);
  const china = getProtectionLevelInfo('china', bird.chinaProtectionLevel);
  const rows = [
    ['英文名', bird.englishName],
    [
      '分类',
      [
        bird.order ? formatTaxonomyDisplay(getOrderChineseName(bird.order), bird.order) : '',
        bird.family ? formatTaxonomyDisplay(getFamilyChineseName(bird.family), bird.family) : '',
        bird.genus,
        bird.species,
      ]
        .filter(Boolean)
        .join(' · '),
    ],
    ['外形', bird.description],
    ['生境', bird.habitat],
    ['分布', bird.distribution],
    ['IUCN', [bird.iucnProtectionLevel, iucn?.description].filter(Boolean).join('。')],
    ['国内', [bird.chinaProtectionLevel, china?.description].filter(Boolean).join('。')],
    ['名录', [bird.references, bird.taxonomyCode ? `编号 ${bird.taxonomyCode}` : ''].filter(Boolean).join(' · ')],
  ].filter(([, value]) => String(value || '').trim());

  if (!rows.length) {
    return <p className={styles.muted}>这只鸟还没有写成条目。可到完善信息里补。</p>;
  }

  return (
    <dl className={styles.dossier}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.dossierRow}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TabMedia({ bird, images, calls, photo, setPhoto }) {
  const src = photoUrl(images[photo]);
  const tags = normalizeBirdImageTags(images[photo]?.tags || []);
  const marks = fieldMarks(bird);
  return (
    <div className={styles.identify}>
      <div className={styles.idHero}>
        {src ? (
          <Image src={src} alt={bird.name} fill unoptimized className={styles.cover} />
        ) : (
          <div className={styles.noPhoto}>无图</div>
        )}
      </div>
      <Filmstrip images={images} active={photo} onPick={setPhoto} />
      {tags.length ? (
        <div className={styles.pills}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.idGrid}>
        <div>
          <h3 className={styles.blockTitle}>看什么</h3>
          {marks.length ? (
            <ul className={styles.marks}>
              {marks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>还没写外形要点。可到完善信息里补。</p>
          )}
        </div>
        <div>
          <h3 className={styles.blockTitle}>鸣叫</h3>
          <CallBar calls={calls} />
        </div>
      </div>
    </div>
  );
}

function TabTrail({ sightings, birdName = '' }) {
  return (
    <div className={styles.trail}>
      <h3 className={styles.blockTitle}>足迹 {sightings.length ? `· ${sightings.length}` : ''}</h3>
      <ol className={styles.trailLine}>
        {sightings.length ? (
          sightings.map((item, index) => {
            const names = Array.isArray(item.speciesNames)
              ? item.speciesNames.filter((n) => n && n !== birdName)
              : [];
            const region = regionLabel(item);
            const body = (
              <>
                <span className={styles.trailPlace}>
                  <strong>{placeName(item)}</strong>
                  <span className={styles.trailMeta}>
                    {fmtDate(item.date)}
                    {region ? ` · ${region}` : ''}
                  </span>
                </span>
                {names.length ? (
                  <span className={styles.trailBirds}>
                    <span className={styles.trailBirdNames}>{names.slice(0, 4).join(' · ')}</span>
                    <span className={styles.trailBirdCount}>共{item.speciesCount || names.length + 1}种</span>
                  </span>
                ) : (
                  <span className={styles.trailBirds} />
                )}
              </>
            );
            return (
              <li key={item.recordId || index}>
                <span className={styles.dot} aria-hidden="true" />
                {item.recordId ? (
                  <Link href={`/records/${item.recordId}`} className={styles.trailBody}>
                    {body}
                  </Link>
                ) : (
                  <span className={styles.trailBody}>{body}</span>
                )}
              </li>
            );
          })
        ) : (
          <li>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.muted}>还没有足迹。记下观察后，这里会按次列出地点和同行鸟种。</span>
          </li>
        )}
      </ol>
    </div>
  );
}

function BirdDetailLabInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || DEFAULT_ID;
  const [tab, setTab] = useState('plate');
  const [bird, setBird] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.birds
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        if (!res?.success || !res.data) {
          throw new Error(res?.message || '读不到这只鸟');
        }
        setBird(res.data);
        setPhoto(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setBird(null);
          setError(err.message || '读不到这只鸟');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const images = useMemo(() => (Array.isArray(bird?.images) ? bird.images : []), [bird]);
  const calls = useMemo(() => (Array.isArray(bird?.calls) ? bird.calls : []), [bird]);
  const sightings = useMemo(() => {
    const list = Array.isArray(bird?.sightings) ? [...bird.sightings] : [];
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return list;
  }, [bird]);
  const stats = useMemo(() => {
    const last = sightings[0];
    return {
      count: sightings.length,
      lastDate: last ? fmtDate(last.date) : '—',
      lastPlace: last ? placeName(last) : '—',
    };
  }, [sightings]);

  const active = PAGE_TABS.find((item) => item.id === tab) || PAGE_TABS[0];

  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          eyebrow="试验台 · 不进导航"
          title="鸟种详情草案"
          description="草案已接到正式详情。这里仍可用白鹭看布局。"
          descriptionVariant="caption"
        />

        <div className="kb-view-bar">
          <div className="kb-view-seg" role="tablist" aria-label="详情分页">
            {PAGE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`kb-view-tab${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="kb-view-hint">{active.hint}</p>
        </div>

        <p className={styles.labNote}>
          数据来自 <Link href={`/birds/${id}`}>现行详情</Link>
          。换鸟在地址后加 <code>?id=鸟种ID</code>。
        </p>

        {loading ? <PageState type="loading" title="读这只鸟..." /> : null}
        {!loading && error ? (
          <PageState type="error" title="草案读不到数据" message={error} />
        ) : null}
        {!loading && bird ? (
          <>
            <Identity bird={bird} />
            {tab === 'plate' ? (
              <TabPlate
                bird={bird}
                id={id}
                stats={stats}
                images={images}
                photo={photo}
                onOpen={setTab}
              />
            ) : null}
            {tab === 'info' ? <TabInfo bird={bird} /> : null}
            {tab === 'media' ? (
              <TabMedia
                bird={bird}
                images={images}
                calls={calls}
                photo={photo}
                setPhoto={setPhoto}
              />
            ) : null}
            {tab === 'trail' ? <TabTrail sightings={sightings} birdName={bird.name} /> : null}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

export default function BirdDetailLabPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.shell}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="打开草案..." />
          </main>
          <Footer />
        </div>
      }
    >
      <BirdDetailLabInner />
    </Suspense>
  );
}

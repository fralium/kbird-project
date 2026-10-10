'use client';

import Image from 'next/image';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import SimplePageHeader from '../../../components/SimplePageHeader';
import styles from '../../../styles/ScrapCardDemo.module.css';

const LEVELS = [
  {
    id: 'brief',
    title: '简版',
    hint: '左上中文和拉丁名，右上这只鸟的邮票，照片撕边。',
  },
  {
    id: 'mid',
    title: '中等',
    hint: '再加观鸟日期、生境和特征。',
  },
  {
    id: 'full',
    title: '详细',
    hint: '再加上记录页里已有的地点、天气、数量和备注。',
  },
];

const SIGHTINGS = [
  {
    name: '白鹭',
    sci: 'Egretta garzetta',
    date: '2026.09.25',
    place: '五常湿地',
    weather: '晴',
    count: '1 只',
    habitat: '湿地',
    traits: ['白色飞羽', '黑色长喙', '黄色脚爪'],
    note: '它展开双翼，从芦苇上方轻轻飞过。',
    image: '/uploads/active/image-1788879852346-771994683.png',
  },
  {
    name: '夜鹭',
    sci: 'Nycticorax nycticorax',
    date: '2026.09.08',
    place: '南湖公园',
    weather: '',
    count: '3 只',
    habitat: '湖岸',
    traits: ['灰背', '白腹'],
    note: '停在柳枝上，天色暗下来才飞。',
    image: '/uploads/active/image-1788806818489-440133830.png',
  },
];

function SpeciesStamp({ item }) {
  return (
    <div className={styles.stamp} aria-hidden="true">
      <div className={styles.stampPhoto}>
        <Image src={item.image} alt="" fill sizes="72px" unoptimized />
      </div>
      <span className={styles.stampName}>{item.name}</span>
    </div>
  );
}

function TornPhoto({ item }) {
  return (
    <div className={styles.torn}>
      <Image src={item.image} alt={item.name} fill sizes="(max-width: 800px) 100vw, 320px" unoptimized />
    </div>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Postmark({ item }) {
  const arcId = `postmark-${item.name}`;
  return (
    <svg className={styles.postmark} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#8a5a32" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="#8a5a32" strokeWidth="0.7" />
      <path id={arcId} d="M16,52 a34,30 0 0,1 68,0" fill="none" />
      <text fill="#8a5a32" fontSize="10" letterSpacing="1.4">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {item.place}
        </textPath>
      </text>
      <text x="50" y="48" textAnchor="middle" fill="#8a5a32" fontSize="9" fontFamily="Palatino, Georgia, serif">
        {item.date}
      </text>
      <path d="M24,62 H76" stroke="#8a5a32" strokeWidth="0.6" />
    </svg>
  );
}

function BookCard({ item }) {
  return (
    <article className={styles.book}>
      <header className={styles.bookHead}>
        <div>
          <h3>{item.name}</h3>
          <p>{item.sci}</p>
        </div>
        <div className={styles.bookMeta}>
          <div className={styles.bookFacts}>
            <p><span>日期</span>{item.date}</p>
            <p><span>地点</span>{item.place}</p>
          </div>
          <Postmark item={item} />
        </div>
      </header>
      <div className={styles.bookFrame}>
        <div className={styles.bookPhoto}>
          <Image src={item.image} alt={item.name} fill sizes="(max-width: 800px) 100vw, 420px" unoptimized />
        </div>
      </div>
    </article>
  );
}

function DiaryCard({ item, level }) {
  const traits = item.traits.length ? item.traits.join('、') : '';
  return (
    <article className={styles.sheet}>
      <header className={styles.head}>
        <div>
          <h3>{item.name}</h3>
          <p>{item.sci}</p>
        </div>
        <SpeciesStamp item={item} />
      </header>
      <TornPhoto item={item} />
      {level === 'brief' ? null : (
        <dl className={styles.facts}>
          <Fact label="日期" value={item.date} />
          {level === 'full' ? <Fact label="地点" value={item.place} /> : null}
          {level === 'full' ? <Fact label="天气" value={item.weather} /> : null}
          {level === 'full' ? <Fact label="数量" value={item.count} /> : null}
          <Fact label="生境" value={item.habitat} />
          <Fact label="特征" value={traits} />
          {level === 'full' ? <Fact label="备注" value={item.note} /> : null}
        </dl>
      )}
    </article>
  );
}

export default function ScrapCardDemoPage() {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="手账密度草案"
          description="上面是日记纸三档，下面是旧书。还没接到观察记录上。"
          descriptionVariant="caption"
        />
        <div className={styles.columns}>
          {LEVELS.map((level) => (
            <section key={level.id} className={styles.column}>
              <h2>{level.title}</h2>
              <p>{level.hint}</p>
              {SIGHTINGS.map((item) => (
                <DiaryCard key={item.name} item={item} level={level.id} />
              ))}
            </section>
          ))}
        </div>
        <section className={styles.bookSection}>
          <h2>旧书</h2>
          <p>左上名字和拉丁名，右上日期、地点，角上盖一枚邮戳。</p>
          <div className={styles.bookGrid}>
            {SIGHTINGS.map((item) => (
              <BookCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

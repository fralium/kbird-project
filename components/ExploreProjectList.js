'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import SimplePageHeader from './SimplePageHeader';
import { listExploreProjects } from '../data/exploreDemo/projects';
import { api } from '../utils/api';
import { resolvePlotCover, useHabitatCoverSet } from '../utils/habitatCover';
import styles from '../styles/ExploreDemo.module.css';

function matchLinkedPlot(project, plots) {
  if (!Array.isArray(plots) || !plots.length) return null;
  const byId = project.linkedPlotId
    ? plots.find((p) => String(p._id) === String(project.linkedPlotId))
    : null;
  if (byId) return byId;
  const title = String(project.linkedPlotTitle || '').trim();
  if (!title) return null;
  return plots.find((p) => String(p.title || '').trim() === title) || null;
}

export default function ExploreProjectList() {
  const projects = listExploreProjects();
  const primaryProject = projects[0];
  const [plots, setPlots] = useState([]);
  const [coverSet] = useHabitatCoverSet();

  useEffect(() => {
    let cancelled = false;
    api.personal
      .getPlots()
      .then((res) => {
        if (cancelled || !res?.success) return;
        setPlots(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setPlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usedUrls = new Set();

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="我的调查"
          description="本地演示：按地区做调查。确认后可并入自留地。"
          descriptionVariant="caption"
        />

        <p className={styles.demoBanner} role="status">
          <strong>演示数据</strong>
          ：公开仓库不含个人调查内容；本机可自行放入探索数据。确认后可并进自留地。新建项目入口暂未开放。
        </p>

        <section className={styles.panel} aria-label="调查项目列表">
          <h2 className={styles.panelTitle}>调查项目</h2>
          <p className={styles.panelHint}>点一个项目进工作台</p>

          <div className={styles.projectGrid}>
            {projects.map((project) => {
              const linked = matchLinkedPlot(project, plots);
              const cover = resolvePlotCover(
                {
                  _id: linked?._id || project.id,
                  title: linked?.title || project.title,
                  spot: linked?.spot || '',
                  city: linked?.city || project.regionShort || '',
                  district: linked?.district || '',
                  province: linked?.province || '',
                  habitatImages: linked?.habitatImages,
                  coverHabitatUrl: linked?.coverHabitatUrl,
                  habitatImageUrl: linked?.habitatImageUrl,
                  coverBirds: linked?.coverBirds,
                },
                usedUrls,
                coverSet
              );
              return (
                <Link
                  key={project.id}
                  href={`/personal/projects/${project.id}`}
                  className={styles.projectCard}
                >
                  <div className={styles.projectMedia}>
                    <Image
                      src={cover.url}
                      alt=""
                      fill
                      sizes="(max-width: 900px) 100vw, 33vw"
                      unoptimized
                      className={styles.projectCoverImage}
                    />
                    <div className={styles.projectShade} aria-hidden="true" />
                    <span className={styles.projectDemoBadge}>Demo</span>
                    {cover.source === 'bird' && cover.birdName ? (
                      <span className={styles.projectBirdBadge}>
                        {cover.level ? `${cover.level} · ` : ''}
                        {cover.birdName}
                      </span>
                    ) : null}
                    <div className={styles.projectOverlay}>
                      <div className={styles.projectCardTop}>
                        <span className={styles.projectCardLabel}>{project.template}</span>
                      </div>
                      <h3 className={styles.projectCardTitle}>{project.title}</h3>
                      <p className={styles.projectCardRegion}>{project.regionShort}</p>
                      <div className={styles.projectCardStats}>
                        <span>
                          {project.stats.recorded}/{project.stats.total} 已记录
                        </span>
                        <span>
                          重点 {project.stats.keyConfirmed}/{project.stats.keyTargets}
                        </span>
                        <span>样区 {project.stats.plotsFilled}</span>
                      </div>
                      <span className={styles.projectCardCta}>进入调查 →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className={styles.pageNote}>
            新建调查项目即将开放。
            {primaryProject ? (
              <>
                {' '}
                现在可先体验{' '}
                <Link href={`/personal/projects/${primaryProject.id}`}>
                  {primaryProject.title}
                </Link>
                。
              </>
            ) : null}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

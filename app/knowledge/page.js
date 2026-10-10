'use client';

import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SimplePageHeader from '../../components/SimplePageHeader';
import PageState from '../../components/PageState';
import { knowledgeData } from '../../data/knowledgeData';
import styles from '../../styles/Knowledge.module.css';

export default function KnowledgePage() {
  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="鸟类知识"
          description="形态、习性和识别要点"
          descriptionVariant="caption"
        />

        <div className={styles.content}>
          {knowledgeData.length === 0 ? (
            <PageState
              type="empty"
              title="条目还没写好"
              message="这一栏暂时空着，写好后再放进来。"
            />
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}

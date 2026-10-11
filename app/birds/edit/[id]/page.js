'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AuthGate from '@/components/AuthGate';
import PageState from '@/components/PageState';
import BirdAdminForm, {
  EMPTY_BIRD_ADMIN_FORM,
  splitBirdAdminAliases,
  splitBirdAdminTags,
} from '@/components/BirdAdminForm';
import { resolveProtectionLevels } from '@/data/protectionLevels';
import {
  taxonomyPayloadForApi,
  taxonomySelectionFromBird,
} from '@/utils/birdTaxonomyParse';
import { api } from '@/utils/api';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import styles from '@/styles/AddBird.module.css';

function EditBirdContent() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const [formData, setFormData] = useState(EMPTY_BIRD_ADMIN_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadBirdData = useCallback(async () => {
    try {
      const data = await api.birds.getById(id);
      if (data.success) {
        const birdData = data.data;
        setFormData({
          ...EMPTY_BIRD_ADMIN_FORM,
          name: birdData.name || '',
          scientificName: birdData.scientificName || '',
          nameAliases: Array.isArray(birdData.nameAliases)
            ? birdData.nameAliases.join('、')
            : birdData.nameAliases || '',
          description: birdData.description || '',
          habitat: birdData.habitat || '',
          distribution: birdData.distribution || '',
          conservationStatus: birdData.conservationStatus || '',
          chinaProtectionLevel: birdData.chinaProtectionLevel || '',
          iucnProtectionLevel: birdData.iucnProtectionLevel || '',
          taxonomy: taxonomySelectionFromBird(birdData),
          tags: Array.isArray(birdData.tags) ? birdData.tags.join(', ') : birdData.tags || '',
          size: birdData.size || '',
          weight: birdData.weight || '',
          wingspan: birdData.wingspan || '',
          plumage: birdData.plumage || '',
          bill: birdData.bill || '',
          legs: birdData.legs || '',
          behavior: birdData.behavior || '',
          diet: birdData.diet || '',
          migration: birdData.migration || '',
          breedingSeason: birdData.breedingSeason || '',
          nestType: birdData.nestType || '',
          clutchSize: birdData.clutchSize || '',
          identificationTips: birdData.identificationTips || '',
          similarSpecies: birdData.similarSpecies || '',
          references: birdData.references || '',
        });
      } else {
        setError(data.message || '获取鸟类数据失败');
      }
    } catch (loadError) {
      setError(loadError?.message || '加载鸟类数据失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadBirdData();
  }, [id, loadBirdData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const protection = resolveProtectionLevels({
        chinaProtectionLevel: formData.chinaProtectionLevel,
        iucnProtectionLevel: formData.iucnProtectionLevel,
        conservationStatus: formData.conservationStatus,
      });

      const taxonomy = taxonomyPayloadForApi(formData.taxonomy);
      const { taxonomy: _taxonomy, ...restForm } = formData;
      const data = await api.birds.update(id, {
        ...restForm,
        ...taxonomy,
        ...protection,
        tags: splitBirdAdminTags(formData.tags),
        nameAliases: splitBirdAdminAliases(formData.nameAliases),
      });

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/birds/${id}`);
        }, 2000);
      } else {
        setError(data.message || '更新失败');
      }
    } catch (err) {
      setError(err?.message || '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBird = async () => {
    const ok = await ask({
      message: `确定删除「${formData.name || '此鸟种'}」？\n会一并去掉这只鸟的图片、鸣叫和观察记录。删除后不能恢复。`,
    });
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const data = await api.birds.delete(id);
      if (data.success) {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('已删除该鸟种', 'success', 2500);
        }
        router.push('/birds');
      } else {
        setError(data.message || '删除失败');
      }
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <PageState type="loading" title="加载鸟类数据中..." />
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>✅</div>
          <h2>更新成功！</h2>
          <p>鸟类记录已成功更新，正在跳转到详情页面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <BirdAdminForm
          title="编辑鸟种"
          description="改本机物种资料"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          error={error}
          setError={setError}
          isLoading={isLoading || deleting}
          submitLabel="更新记录"
          onCancel={() => router.back()}
          extraActions={
            <button
              type="button"
              onClick={handleDeleteBird}
              disabled={isLoading || deleting}
              className={styles.deleteButton}
            >
              {deleting ? '删除中…' : '删除此鸟种'}
            </button>
          }
        />
      </main>
      {confirmDialog}
    </div>
  );
}

export default function EditBirdPage() {
  return (
    <AuthGate requireAdmin loadingTitle="正在检查登录状态...">
      <EditBirdContent />
    </AuthGate>
  );
}

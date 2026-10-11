'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthGate from '@/components/AuthGate';
import FormModal from '@/components/FormModal';
import { useErrorHandler } from '@/utils/useErrorHandler';
import ErrorMessage from '@/components/ErrorMessage';
import BirdAdminForm, {
  EMPTY_BIRD_ADMIN_FORM,
  splitBirdAdminAliases,
  splitBirdAdminTags,
} from '@/components/BirdAdminForm';
import { resolveProtectionLevels } from '@/data/protectionLevels';
import { taxonomyPayloadForApi } from '@/utils/birdTaxonomyParse';
import { api } from '@/utils/api';
import { devError } from '@/utils/devLogger';
import styles from '@/styles/AddBird.module.css';

function AddBirdContent() {
  const router = useRouter();
  const redirectTimerRef = useRef(null);
  const { errors, addError, removeError } = useErrorHandler();

  const [formData, setFormData] = useState(EMPTY_BIRD_ADMIN_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const continueSubmit = async () => {
    try {
      const protection = resolveProtectionLevels({
        chinaProtectionLevel: formData.chinaProtectionLevel,
        iucnProtectionLevel: formData.iucnProtectionLevel,
        conservationStatus: formData.conservationStatus,
      });

      const taxonomy = taxonomyPayloadForApi(formData.taxonomy);
      const { taxonomy: _taxonomy, ...restForm } = formData;
      const data = await api.birds.create({
        ...restForm,
        ...taxonomy,
        ...protection,
        tags: splitBirdAdminTags(formData.tags),
        nameAliases: splitBirdAdminAliases(formData.nameAliases),
      });

      if (!data?.success) {
        throw new Error(data.message || '创建鸟类记录失败');
      }

      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        router.push('/birds');
      }, 2000);
    } catch (err) {
      setError(err.message || '创建鸟类记录时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const duplicateData = await api.birds.checkDuplicate({
        name: formData.name,
        scientificName: formData.scientificName,
      });

      if (duplicateData.success && duplicateData.data.hasDuplicates) {
        setDuplicateConfirm({
          duplicates: duplicateData.data.duplicates,
        });
        return;
      }

      await continueSubmit();
    } catch (submitError) {
      devError('提交失败:', submitError);
      addError(`提交失败，请重试：${submitError.message || '未知错误'}`);
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.successMessage}>
            <h2>鸟类记录创建成功！</h2>
            <p>正在跳转到鸟类列表页面...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      {errors.map((item) => (
        <ErrorMessage
          key={item.id}
          error={item.message}
          type={item.type}
          onClose={() => removeError(item.id)}
        />
      ))}

      <FormModal
        open={Boolean(duplicateConfirm)}
        onClose={() => {
          setDuplicateConfirm(null);
          setIsLoading(false);
        }}
        title="发现相似鸟类记录"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setDuplicateConfirm(null);
                setIsLoading(false);
              }}
              className={styles.cancelButton}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setDuplicateConfirm(null);
                continueSubmit();
              }}
              className={styles.confirmButton}
            >
              仍要添加
            </button>
          </>
        }
      >
        <p>以下鸟类记录与您要添加的记录相似，请确认是否继续：</p>
        <div className={styles.duplicatesList}>
          {(duplicateConfirm?.duplicates || []).map((bird, index) => (
            <div key={index} className={styles.duplicateItem}>
              <h4>
                {bird.name} ({bird.scientificName})
              </h4>
              <p>相似度: {bird.similarity}%</p>
              <p>原因: {(bird.matchReasons || []).join(', ')}</p>
            </div>
          ))}
        </div>
      </FormModal>

      <main className={styles.main}>
        <BirdAdminForm
          title="添加鸟种"
          description="补本机鸟种库"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          error={error}
          setError={setError}
          isLoading={isLoading}
          submitLabel="创建鸟类记录"
          onCancel={() => router.back()}
        />
      </main>

      <Footer />
    </div>
  );
}

export default function AddBirdPage() {
  return (
    <AuthGate requireAdmin loadingTitle="检查权限中…">
      <AddBirdContent />
    </AuthGate>
  );
}

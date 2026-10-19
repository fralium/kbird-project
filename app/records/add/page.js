'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import { useErrorHandler } from '@/utils/useErrorHandler';
import ErrorMessage from '@/components/ErrorMessage';
import MultiBirdForm from '@/components/MultiBirdForm';
import SimplePageHeader from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { api } from '@/utils/api';
import { consumeRecordDraft } from '@/utils/recordDraft';
import { devError, devLog } from '@/utils/devLogger';
import styles from '@/styles/AddRecord.module.css';

function AddRecordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { errors, addError, removeError } = useErrorHandler();
  const [initialData, setInitialData] = useState({});
  const [draftNotice, setDraftNotice] = useState('');

  useEffect(() => {
    const birdId = searchParams?.get('birdId') || '';
    const birdName = searchParams?.get('birdName') || '';
    const aiResult = searchParams?.get('aiResult') || '';
    const hasQueryPrefill = Boolean(birdId || birdName || String(aiResult || '').trim());

    if (!hasQueryPrefill) {
      const draft = consumeRecordDraft();
      if (draft) {
        setInitialData(draft);
        setDraftNotice('已填入文字草稿。请核对地点、鸟种和数量后再保存，模型结果不会自动入库。');
      }
      return;
    }

    let parsedResult = null;
    if (typeof aiResult === 'string' && aiResult.trim()) {
      try {
        parsedResult = JSON.parse(aiResult);
      } catch (error) {
        devLog('AI结果解析失败，跳过预填:', error.message);
      }
    }

    const matchedBird = parsedResult?.matchedBird;
    const resolvedBirdId = birdId || matchedBird?._id;
    const resolvedName = matchedBird?.name || parsedResult?.name || birdName || '';
    const resolvedScientificName = matchedBird?.scientificName || parsedResult?.scientificName || '';
    const candidateHints = Array.isArray(parsedResult?.candidates)
      ? parsedResult.candidates
          .slice(0, 3)
          .map((item, index) => {
            const candidateName = item?.name || '未知';
            const candidateConfidence = Number(item?.confidence);
            const confidenceText = Number.isFinite(candidateConfidence)
              ? `${Math.round(
                  (candidateConfidence > 1 ? candidateConfidence / 100 : candidateConfidence) * 100
                )}%`
              : '-';
            return `${index + 1}. ${candidateName}（${confidenceText}）`;
          })
          .join('\n')
      : '';

    const prefills = {
      notes: parsedResult
        ? `AI识别建议：${resolvedName || '未知物种'}${
            parsedResult.confidence
              ? `（置信度 ${Math.round(parsedResult.confidence * 100)}%）`
              : ''
          }${candidateHints ? `\n候选对比：\n${candidateHints}` : ''}`
        : '',
    };

    if (resolvedBirdId) {
      prefills.birds = [
        {
          bird: {
            _id: resolvedBirdId,
            name: resolvedName || 'AI识别鸟类',
            scientificName: resolvedScientificName,
          },
          birdId: resolvedBirdId,
          notes: parsedResult?.reasoning || '',
          count: 1,
          images: [],
        },
      ];
    }

    setInitialData(prefills);
  }, [searchParams]);

  const handleSubmit = async (formData) => {
    try {
      let token;
      try {
        token = localStorage.getItem('token');
      } catch {
        addError('无法访问本地存储，请检查浏览器设置');
        return;
      }

      if (!token) {
        addError('请先登录');
        return;
      }

      if (!Array.isArray(formData.birds) || formData.birds.length === 0) {
        addError('请至少添加一种鸟类');
        return;
      }

      const locationName = (formData.location?.name || '').trim();
      if (!locationName) {
        addError('请选择观察地点（如 午潮山国家森林公园），在上方「观察地点」处选择或搜索');
        return;
      }

      const processedBirds = await Promise.all(
        formData.birds.map(async (bird) => {
          const uploadedImages = [];

          if (bird.images && bird.images.length > 0) {
            for (const image of bird.images) {
              if (image.file) {
                const imageData = await api.upload.image(image.file);

                if (imageData.success) {
                  uploadedImages.push({
                    url: imageData.url || imageData.data?.url,
                    caption: image.caption,
                  });
                } else {
                  devError('图片上传失败:', imageData.message);
                  throw new Error(`图片上传失败: ${imageData.message}`);
                }
              }
            }
          }

          return {
            birdId: bird.bird?._id || bird.birdId?._id || bird.birdId,
            notes: bird.notes || '',
            behaviorTags: Array.isArray(bird.behaviorTags) ? bird.behaviorTags : [],
            images: uploadedImages,
            count: bird.count || 1,
          };
        })
      );

      const raw = formData.location?.coordinates;
      const coords = Array.isArray(raw) ? raw : raw?.coordinates || null;
      const lng = Number(coords?.[0]);
      const lat = Number(coords?.[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
        addError('请从地点词典选择带坐标的地点，或先在地点词典中补全坐标');
        return;
      }
      const addr = formData.location?.address || {};
      const locationPayload = {
        name: formData.location?.name || '',
        coordinates: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        address: {
          province: addr.province || '',
          city: addr.city || '',
          district: addr.district || '',
          detail: addr.detail || addr.street || '',
        },
      };

      const recordData = {
        title: `${formData.location.name}观鸟记录`,
        location: locationPayload,
        date: formData.date,
        observer: user._id,
        notes: formData.notes,
        weather: formData.weather || '',
        temperature: formData.temperature || null,
        humidity: formData.humidity || null,
        wind: formData.wind || '',
        effort: formData.effort || {},
        status: 'published',
        birds: processedBirds,
      };

      const data = await api.records.create(recordData);

      if (data.success) {
        addError(`观鸟记录创建成功！共记录 ${formData.birds.length} 种鸟类`, 'success');
        setTimeout(() => {
          router.push('/records');
        }, 1500);
      } else {
        addError(`创建失败：${data.message || '未知错误'}`);
      }
    } catch (error) {
      devError('创建记录失败:', error);
      addError(`创建失败，请重试：${error.message || '未知错误'}`);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className={styles.container}>
      <Navbar />

      {errors.map((error) => (
        <ErrorMessage
          key={error.id}
          error={error.message}
          type={error.type}
          onClose={() => removeError(error.id)}
        />
      ))}

      <main className={styles.main}>
        <SimplePageHeader
          title="添加观察记录"
          description="把一次观察记完整"
          descriptionVariant="caption"
        />

        {draftNotice ? <p className={styles.draftNotice}>{draftNotice}</p> : null}

        <div className={styles.formContainer}>
          <MultiBirdForm onSubmit={handleSubmit} onCancel={handleCancel} initialData={initialData} />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function AddRecordPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="添加记录加载中..." />
          </main>
          <Footer />
        </div>
      }
    >
      <AuthGate loadingTitle="添加记录加载中...">
        <AddRecordPageClient />
      </AuthGate>
    </Suspense>
  );
}

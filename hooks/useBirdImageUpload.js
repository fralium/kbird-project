'use client';

import { useCallback, useState } from 'react';
import { api } from '../utils/api';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Shared bird gallery image upload (admin detail / related flows).
 */
export function useBirdImageUpload(birdId, { onSuccess, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = useCallback(
    async (file, extraFields = {}) => {
      if (!birdId || !file) return null;
      if (file.size > maxBytes) {
        setError(`图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`);
        return null;
      }
      if (file.type && !DEFAULT_TYPES.includes(file.type)) {
        setError('仅支持 JPEG / PNG / WebP / GIF');
        return null;
      }

      setUploading(true);
      setError('');
      try {
        const formData = new FormData();
        formData.append('image', file);
        Object.entries(extraFields).forEach(([key, value]) => {
          if (value != null && value !== '') formData.append(key, value);
        });
        const data = await api.birds.addImage(birdId, formData);
        if (!data?.success) {
          throw new Error(data?.message || '上传失败');
        }
        onSuccess?.(data);
        return data;
      } catch (err) {
        setError(err?.message || '上传失败');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [birdId, maxBytes, onSuccess]
  );

  return { uploadFile, uploading, error, setError };
}

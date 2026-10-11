'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ImageViewer from './ImageViewer';
import { useConfirmDialog } from './ConfirmDialog';
import { getFullImageUrl, isValidImageUrl } from '@/utils/imageUtils';
import styles from '@/styles/HabitatGallery.module.css';

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return getFullImageUrl(url) || url;
}

export default function HabitatGallery({
  title = '生境图',
  images = [],
  canUpload = false,
  canDelete = false,
  onUpload,
  onDelete,
  onSetCover,
  onUpdateCaption,
  emptyText = '暂无生境照片',
  hint,
  currentLocationId = '',
  linkCaptions = true,
}) {
  const inputRef = useRef(null);
  const captionInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [busyIndex, setBusyIndex] = useState(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [captionIndex, setCaptionIndex] = useState(null);
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const list = Array.isArray(images) ? images.filter((img) => img?.url) : [];
  const canManage = Boolean(
    canDelete && (onDelete || onSetCover || onUpdateCaption)
  );

  useEffect(() => {
    if (captionIndex == null) return undefined;
    const timer = window.setTimeout(() => captionInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [captionIndex]);

  const openViewer = (index) => {
    if (editing) return;
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handlePick = () => {
    if (!canUpload || uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUpload) return;
    setUploading(true);
    setMessage('');
    try {
      await onUpload(file);
      setMessage('已添加到生境库');
    } catch (error) {
      setMessage(error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const runImageAction = async (index, action, successText) => {
    if (busyIndex != null) return;
    setBusyIndex(index);
    setMessage('');
    try {
      await action();
      if (successText) setMessage(successText);
    } catch (error) {
      setMessage(error?.message || '操作失败');
    } finally {
      setBusyIndex(null);
    }
  };

  const handleDelete = async (index) => {
    if (!onDelete) return;
    const ok = await ask('确定从地点生境库删除这张照片？');
    if (!ok) return;
    await runImageAction(index, () => onDelete(index));
    if (captionIndex === index) {
      setCaptionIndex(null);
      setCaptionDraft('');
    }
  };

  const handleSetCover = async (index) => {
    if (!onSetCover || index === 0) return;
    await runImageAction(index, () => onSetCover(index), '已设为封面');
    setCaptionIndex(null);
    setCaptionDraft('');
  };

  const startCaptionEdit = (index) => {
    if (!onUpdateCaption) return;
    setCaptionIndex(index);
    setCaptionDraft(String(list[index]?.caption || '').trim());
  };

  const cancelCaptionEdit = () => {
    setCaptionIndex(null);
    setCaptionDraft('');
  };

  const saveCaption = async () => {
    if (captionIndex == null || !onUpdateCaption) return;
    const next = captionDraft.trim().slice(0, 200);
    await runImageAction(
      captionIndex,
      () => onUpdateCaption(captionIndex, next),
      next ? '说明已保存' : '说明已清空'
    );
    setCaptionIndex(null);
    setCaptionDraft('');
  };

  const finishEditing = () => {
    setEditing(false);
    cancelCaptionEdit();
  };

  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {canUpload || canManage ? (
          <div className={styles.actions}>
            {canUpload ? (
              <>
                <button
                  type="button"
                  className={`btn btn-primary ${styles.uploadBtn}`}
                  onClick={handlePick}
                  disabled={uploading}
                >
                  {uploading ? '上传中…' : '上传生境照'}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                />
              </>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className={`${styles.textAction}${editing ? ` ${styles.textActionActive}` : ''}`}
                onClick={() => (editing ? finishEditing() : setEditing(true))}
                aria-pressed={editing}
              >
                {editing ? '完成' : '编辑'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}

      {message ? <p className={styles.message}>{message}</p> : null}
      {editing ? (
        <p className={styles.editHint}>编辑中：可设封面、补说明或删除。</p>
      ) : null}

      {list.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div className={styles.grid}>
          {list.map((image, index) => {
            const src = resolveUrl(image.url);
            if (!isValidImageUrl(src) && !src) return null;
            const caption = String(image.caption || image.locationName || '').trim();
            const samePlace =
              currentLocationId &&
              image.locationId &&
              String(image.locationId) === String(currentLocationId);
            const locationHref =
              linkCaptions && image.locationId && !samePlace
                ? `/locations/${image.locationId}`
                : '';
            const isCover = index === 0;
            const showMeta = Boolean(caption || isCover || (editing && canManage));
            const editingCaption = captionIndex === index;
            const busy = busyIndex === index;
            return (
              <div
                key={`${image.url}-${index}`}
                className={`${styles.card}${editing ? ` ${styles.cardEditing}` : ''}${
                  isCover ? ` ${styles.cardCover}` : ''
                }`}
              >
                <div className={styles.thumbWrap}>
                  <button
                    type="button"
                    className={styles.thumbBtn}
                    onClick={() => openViewer(index)}
                    aria-label={
                      editing ? `生境照片 ${index + 1}` : `查看生境照片 ${index + 1}`
                    }
                  >
                    <Image
                      src={src}
                      alt={caption || `生境照片 ${index + 1}`}
                      width={280}
                      height={180}
                      unoptimized
                      className={styles.thumb}
                    />
                  </button>
                  {isCover ? <span className={styles.coverBadge}>封面</span> : null}
                </div>
                {showMeta ? (
                  <div className={styles.meta}>
                    {caption && locationHref ? (
                      <Link href={locationHref} className={styles.captionLink}>
                        {caption}
                      </Link>
                    ) : caption ? (
                      <span className={styles.caption}>{caption}</span>
                    ) : (
                      <span className={styles.captionPlaceholder}>
                        {editing ? '无说明' : ''}
                      </span>
                    )}
                  </div>
                ) : null}
                {editing && canManage ? (
                  <div className={styles.editTools}>
                    {onSetCover ? (
                      <button
                        type="button"
                        className={styles.toolBtn}
                        onClick={() => handleSetCover(index)}
                        disabled={busy || isCover}
                      >
                        {isCover ? '当前封面' : '设为封面'}
                      </button>
                    ) : null}
                    {onUpdateCaption ? (
                      <button
                        type="button"
                        className={styles.toolBtn}
                        onClick={() => startCaptionEdit(index)}
                        disabled={busy}
                      >
                        {caption ? '改说明' : '补说明'}
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(index)}
                        disabled={busy}
                      >
                        {busy ? '…' : '删除'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {editingCaption ? (
                  <div className={styles.captionEditor}>
                    <input
                      ref={captionInputRef}
                      type="text"
                      className={styles.captionInput}
                      value={captionDraft}
                      maxLength={200}
                      placeholder="例如：坝下芦苇、晨雾湿地…"
                      onChange={(event) => setCaptionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveCaption();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelCaptionEdit();
                        }
                      }}
                      disabled={busy}
                    />
                    <div className={styles.captionActions}>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        onClick={saveCaption}
                        disabled={busy}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        onClick={cancelCaptionEdit}
                        disabled={busy}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {viewerOpen ? (
        <ImageViewer
          images={list}
          currentIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
      {confirmDialog}
    </section>
  );
}

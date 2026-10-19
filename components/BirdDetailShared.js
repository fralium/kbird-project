'use client';
import LazyImage from '@/components/LazyImage';
import ImageViewer from '@/components/ImageViewer';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import FormModal from '@/components/FormModal';
import { getFullImageUrl, isValidImageUrl, getImageKey } from '@/utils/imageUtils';
import { BIRD_IMAGE_TAG_GROUPS, normalizeBirdImageTags } from '@/data/birdImageTags';
import { BIRD_CALL_TAG_GROUPS, normalizeBirdCallTags } from '@/data/birdCallTags';
import { getProtectionLevelInfo } from '@/data/protectionLevels';
import styles from '@/styles/BirdDetail.module.css';

export function ProtectionStatusBadges({ bird, className = '' }) {
  const items = [
    bird?.iucnProtectionLevel
      ? { type: 'iucn', level: bird.iucnProtectionLevel, label: `IUCN ${bird.iucnProtectionLevel}` }
      : null,
    bird?.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入'
      ? { type: 'china', level: bird.chinaProtectionLevel, label: `中国 ${bird.chinaProtectionLevel}` }
      : null,
  ].filter(Boolean);

  if (items.length === 0) {
    return <span className={styles.protectionEmpty}>—</span>;
  }

  return (
    <span className={`${styles.protectionBadges} ${className}`.trim()}>
      {items.map((item) => {
        const info = getProtectionLevelInfo(item.type, item.level);
        const color = item.type === 'china' ? '#fd7e14' : '#219EBC';
        return (
          <span
            key={`${item.type}-${item.level}`}
            className={`${styles.protectionBadge} ${styles.protectionBadgeElevated}`}
            style={{ '--badge-color': color }}
            title={info?.description || item.label}
          >
            {item.label}
          </span>
        );
      })}
    </span>
  );
}

export function BirdImagesSection({ controller, beforeGrid = null }) {
  const {
    user,
    bird,
    uploading,
    error,
    managingImages,
    setManagingImages,
    compactImages,
    setCompactImages,
    handleImageUpload,
    handleImageClick,
    handleSetMainImage,
    handleEditImage,
    handleDeleteImage,
    canManageImage,
  } = controller;

  return (
    <section id="bird-images" className={styles.pageSection}>
      <div className={styles.sectionHeading}>
        <h2>图片</h2>
        <span className={styles.sectionCount}>{bird.images?.length || 0}</span>
        <div className={styles.sectionHeadingActions}>
          {user ? (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="image-upload"
                disabled={uploading}
              />
              <label htmlFor="image-upload" className={styles.uploadQuietButton}>
                {uploading ? '上传中…' : '+ 上传'}
              </label>
              {bird.images?.length ? (
                <button
                  type="button"
                  className={`${styles.uploadQuietButton} ${managingImages ? styles.manageOn : ''}`}
                  onClick={() => setManagingImages((open) => !open)}
                >
                  {managingImages ? '完成' : '操作'}
                </button>
              ) : null}
            </>
          ) : null}
          {bird.images?.length ? (
            <button
              type="button"
              className={`${styles.uploadQuietButton} ${compactImages ? styles.manageOn : ''}`}
              onClick={() => setCompactImages((open) => !open)}
            >
              {compactImages ? '大图' : '缩略图'}
            </button>
          ) : null}
        </div>
      </div>

      {beforeGrid}

      <div className={styles.imagesTab}>
        {managingImages ? (
          <p className={styles.manageHint}>点照片仍可放大。设主图、编辑、删除在每张照片下面。</p>
        ) : null}
        {bird.images && bird.images.length > 0 ? (
          <div className={`${styles.imageGrid} ${compactImages ? styles.imageGridCompact : ''}`}>
            {bird.images.map((image, index) => (
              <div
                key={getImageKey(image.url, index)}
                className={`${styles.imageItem} ${index === 0 ? styles.imageItemMain : ''} ${
                  managingImages ? styles.imageItemManaging : ''
                }`}
              >
                <div className={styles.imageContainer}>
                  <LazyImage
                    src={getFullImageUrl(image.url)}
                    alt={image.caption || `图片 ${index + 1}`}
                    width={640}
                    height={420}
                    fillContainer
                    objectFit="cover"
                    className={styles.image}
                    onClick={() => handleImageClick(index)}
                    onError={() => {
                      console.error('图片加载失败:', {
                        originalUrl: image.url,
                        fullUrl: getFullImageUrl(image.url),
                        isValid: isValidImageUrl(image.url),
                      });
                    }}
                  />
                  <div className={styles.imageError} style={{ display: 'none' }}>
                    <span>图片加载失败</span>
                  </div>
                </div>
                {(index === 0 ||
                  image.caption ||
                  (Array.isArray(image.tags) && image.tags.length > 0)) && (
                  <div className={styles.imageMeta}>
                    <div className={styles.imageMetaTop}>
                      {index === 0 ? <span className={styles.mainFlag}>主图</span> : null}
                      {Array.isArray(image.tags) && image.tags.length > 0 ? (
                        <div className={styles.imageTagRow}>
                          {normalizeBirdImageTags(image.tags).map((tag) => (
                            <span key={tag} className={styles.imageTag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {image.caption ? <div className={styles.imageCaption}>{image.caption}</div> : null}
                  </div>
                )}
                {managingImages && canManageImage() ? (
                  <div className={styles.imageToolbar}>
                    {index > 0 ? (
                      <button type="button" onClick={() => handleSetMainImage(index)}>
                        设为主图
                      </button>
                    ) : null}
                    <button type="button" onClick={() => handleEditImage(image, index)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className={styles.toolbarDanger}
                      onClick={(event) => handleDeleteImage(event, index)}
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyImages}>
            <p>还没有本种照片</p>
            {user ? (
              <label htmlFor="image-upload" className={styles.emptyImagesAction}>
                {uploading ? '上传中…' : '上传第一张照片'}
              </label>
            ) : (
              <span>登录后可上传</span>
            )}
          </div>
        )}
        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    </section>
  );
}

export function BirdCallsSection({ controller }) {
  const {
    user,
    bird,
    uploadingCall,
    handleCallUpload,
    canManageCall,
    handleEditCall,
    handleDeleteCall,
  } = controller;

  return (
    <section id="bird-calls" className={styles.pageSection}>
      <div className={styles.sectionHeading}>
        <h2>鸣叫</h2>
        <span className={styles.sectionCount}>{bird.calls?.length || 0}</span>
        {user ? (
          <div className={styles.sectionHeadingActions}>
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.webm"
              onChange={handleCallUpload}
              style={{ display: 'none' }}
              id="call-upload"
              disabled={uploadingCall}
            />
            <label htmlFor="call-upload" className={styles.uploadQuietButton}>
              {uploadingCall ? '上传中…' : '+ 上传'}
            </label>
          </div>
        ) : null}
      </div>

      <div className={styles.callsTab}>
        {bird.calls && bird.calls.length > 0 ? (
          <div className={styles.callList}>
            {bird.calls.map((call, index) => (
              <div key={`${call.url}-${index}`} className={styles.callItem}>
                <div className={styles.callPlayerRow}>
                  <audio
                    className={styles.callAudio}
                    controls
                    preload="metadata"
                    src={getFullImageUrl(call.url)}
                  >
                    您的浏览器不支持音频播放
                  </audio>
                  {canManageCall() ? (
                    <div className={styles.callActions}>
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => handleEditCall(call, index)}
                        title="编辑鸣叫信息"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={(event) => handleDeleteCall(event, index)}
                        title="删除鸣叫"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : null}
                </div>
                {(call.caption || (Array.isArray(call.tags) && call.tags.length > 0) || call.location) ? (
                  <div className={styles.callMeta}>
                    {Array.isArray(call.tags) && call.tags.length > 0 ? (
                      <div className={styles.imageTagRow}>
                        {normalizeBirdCallTags(call.tags).map((tag) => (
                          <span key={tag} className={styles.imageTag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {call.caption ? <div className={styles.imageCaption}>{call.caption}</div> : null}
                    {call.location ? <div className={styles.callLocation}>{call.location}</div> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyImages}>
            <p>还没有本种鸣叫录音</p>
            {user ? (
              <label htmlFor="call-upload" className={styles.emptyImagesAction}>
                {uploadingCall ? '上传中…' : '上传第一条鸣叫'}
              </label>
            ) : (
              <span>登录后可上传</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function BirdDetailMediaModals({ controller }) {
  const {
    bird,
    editingImage,
    setEditingImage,
    editingCall,
    setEditingCall,
    editFormData,
    setEditFormData,
    editCallFormData,
    setEditCallFormData,
    toggleEditImageTag,
    toggleEditCallTag,
    handleSaveImageEdit,
    handleSaveCallEdit,
    showImageViewer,
    currentImageIndex,
    handleCloseImageViewer,
    showSightingImageViewer,
    currentSightingImages,
    currentSightingImageIndex,
    handleCloseSightingImageViewer,
    confirmDialog,
  } = controller;

  return (
    <>
      <FormModal
        open={Boolean(editingImage)}
        title="编辑图片信息"
        onClose={() => setEditingImage(null)}
        actions={
          <>
            <button type="button" onClick={() => setEditingImage(null)}>
              取消
            </button>
            <button type="submit" form="bird-edit-image-form">
              保存
            </button>
          </>
        }
      >
        <form id="bird-edit-image-form" onSubmit={handleSaveImageEdit}>
          <div className={styles.formGroup}>
            <label>图片标题</label>
            <input
              type="text"
              value={editFormData.caption || ''}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, caption: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>拍摄地点</label>
            <LocationAutocomplete
              value={editFormData.location || ''}
              onChange={(value) => setEditFormData((prev) => ({ ...prev, location: value }))}
              placeholder="搜索或选择观鸟地点..."
            />
          </div>
          <div className={styles.formGroup}>
            <label>拍摄日期</label>
            <input
              type="date"
              value={editFormData.date || ''}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>图片标签</label>
            <div className={styles.tagEditor}>
              {BIRD_IMAGE_TAG_GROUPS.map((group) => (
                <div key={group.id} className={styles.tagEditorGroup}>
                  <div className={styles.tagEditorGroupLabel}>{group.label}</div>
                  <div className={styles.tagEditorOptions}>
                    {group.options.map((option) => {
                      const selected = normalizeBirdImageTags(editFormData.tags).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.tagChip} ${selected ? styles.tagChipSelected : ''}`}
                          onClick={() => toggleEditImageTag(option.value)}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(editingCall)}
        title="编辑鸣叫信息"
        onClose={() => setEditingCall(null)}
        actions={
          <>
            <button type="button" onClick={() => setEditingCall(null)}>
              取消
            </button>
            <button type="submit" form="bird-edit-call-form">
              保存
            </button>
          </>
        }
      >
        <form id="bird-edit-call-form" onSubmit={handleSaveCallEdit}>
          <div className={styles.formGroup}>
            <label>标题</label>
            <input
              type="text"
              value={editCallFormData.caption || ''}
              onChange={(e) => setEditCallFormData((prev) => ({ ...prev, caption: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>录制地点</label>
            <LocationAutocomplete
              value={editCallFormData.location || ''}
              onChange={(value) => setEditCallFormData((prev) => ({ ...prev, location: value }))}
              placeholder="搜索或选择观鸟地点..."
            />
          </div>
          <div className={styles.formGroup}>
            <label>录制日期</label>
            <input
              type="date"
              value={editCallFormData.date || ''}
              onChange={(e) => setEditCallFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label>鸣叫标签</label>
            <div className={styles.tagEditor}>
              {BIRD_CALL_TAG_GROUPS.map((group) => (
                <div key={group.id} className={styles.tagEditorGroup}>
                  <div className={styles.tagEditorGroupLabel}>{group.label}</div>
                  <div className={styles.tagEditorOptions}>
                    {group.options.map((option) => {
                      const selected = normalizeBirdCallTags(editCallFormData.tags).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.tagChip} ${selected ? styles.tagChipSelected : ''}`}
                          onClick={() => toggleEditCallTag(option.value)}
                          aria-pressed={selected}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </FormModal>

      {showImageViewer && bird?.images && (
        <ImageViewer images={bird.images} currentIndex={currentImageIndex} onClose={handleCloseImageViewer} />
      )}

      {showSightingImageViewer && currentSightingImages && (
        <ImageViewer
          images={currentSightingImages}
          currentIndex={currentSightingImageIndex}
          onClose={handleCloseSightingImageViewer}
        />
      )}

      {confirmDialog}
    </>
  );
}

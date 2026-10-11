'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SimplePageHeader, { HeaderPrimaryButton } from '@/components/SimplePageHeader';
import PageState from '@/components/PageState';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import NotepadLinkedText from '@/components/NotepadLinkedText';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/utils/api';
import { buildNotepadLinkTerms } from '@/utils/linkifyMentions';
import { formatDisplayDateTime } from '@/utils/localDate';
import styles from '@/styles/PersonalNotepad.module.css';

const AUTOSAVE_DEBOUNCE_MS = 1200;
const MAX_NOTE_COUNT = 100;
const MAX_COMMENTS = 100;
const MAX_COMMENT_BODY = 2000;

const makeNoteId = () => `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const makeCommentId = () => `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatBirdNewsTitle = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d} 鸟讯`;
};

const normalizeComments = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_COMMENTS).map((c) => ({
    id: String(c?.id || makeCommentId()),
    quote: String(c?.quote || '').slice(0, 500),
    start: Math.max(0, Number(c?.start) || 0),
    end: Math.max(0, Number(c?.end) || 0),
    body: String(c?.body || '').slice(0, MAX_COMMENT_BODY),
    createdAt: c?.createdAt || new Date().toISOString(),
  }));
};

const createEmptyNote = (title = formatBirdNewsTitle()) => {
  const nowIso = new Date().toISOString();
  return {
    id: makeNoteId(),
    title,
    content: '',
    pinned: false,
    comments: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

const sortNotesForList = (list) =>
  [...(list || [])].sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) return pinDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

const normalizeNotepadPayload = (raw) => {
  if (raw && Array.isArray(raw.notes) && raw.notes.length > 0) {
    const normalizedNotes = sortNotesForList(
      raw.notes.map((note) => ({
        id: String(note?.id || makeNoteId()),
        title: String(note?.title || '未命名便签').slice(0, 120),
        content: String(note?.content || ''),
        pinned: Boolean(note?.pinned),
        comments: normalizeComments(note?.comments),
        createdAt: note?.createdAt || new Date().toISOString(),
        updatedAt: note?.updatedAt || new Date().toISOString(),
      }))
    );
    let activeId = '';
    if (typeof raw.activeNoteId === 'string' && raw.activeNoteId) {
      activeId = normalizedNotes.some((note) => note.id === raw.activeNoteId)
        ? raw.activeNoteId
        : '';
    }
    return {
      notes: normalizedNotes,
      activeNoteId: activeId,
      updatedAt: raw.updatedAt || normalizedNotes[0].updatedAt,
    };
  }

  const legacyContent = typeof raw?.content === 'string' ? raw.content : '';
  const note = createEmptyNote('默认便签');
  note.content = legacyContent;
  return {
    notes: [note],
    activeNoteId: '',
    updatedAt: raw?.updatedAt || null,
  };
};

const formatNoteTime = (value) => {
  if (!value) return '';
  const text = formatDisplayDateTime(value);
  return text === '—' ? '' : text;
};

/** 正文改动后，尽量根据引文重定位评论区间 */
function resolveCommentRange(content, comment) {
  const text = String(content || '');
  const quote = String(comment?.quote || '');
  const start = Number(comment?.start);
  const end = Number(comment?.end);
  if (
    quote &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    text.slice(start, end) === quote
  ) {
    return { start, end, ok: true };
  }
  if (quote) {
    const idx = text.indexOf(quote);
    if (idx >= 0) return { start: idx, end: idx + quote.length, ok: true };
  }
  return { start: 0, end: 0, ok: false };
}

export default function PersonalNotepadPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState('');
  const [status, setStatus] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState(null);
  const [draftComment, setDraftComment] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState('');
  // 阅读态自动出链接；点正文进入编辑（不是单独预览页）
  const [editingBody, setEditingBody] = useState(false);
  const [linkTerms, setLinkTerms] = useState([]);
  const saveTimerRef = useRef(null);
  const hasRedirectedRef = useRef(false);
  const editorRef = useRef(null);
  const editorWrapRef = useRef(null);
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (authLoading) return;
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
    if (!hasToken) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/personal/notepad');
      }
      setLoading(false);
      return;
    }
    if (!user) {
      refreshUser?.().catch(() => null);
      return;
    }
    fetchNotepad();
    loadLinkDictionaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectionMenu(null);
    setComposerOpen(false);
    setDraftComment('');
    setActiveCommentId('');
    setEditingBody(false);
  }, [activeNoteId]);

  const loadLinkDictionaries = async () => {
    try {
      const [taxRes, locRes] = await Promise.all([
        api.personal.getChecklistTaxonomy().catch(() => null),
        api.locations.getAll({ limit: 1000, page: 1 }).catch(() => null),
      ]);
      const birds = Array.isArray(taxRes?.data?.species) ? taxRes.data.species : [];
      const locations = Array.isArray(locRes?.data) ? locRes.data : [];
      setLinkTerms(buildNotepadLinkTerms({ birds, locations }));
    } catch {
      setLinkTerms([]);
    }
  };

  const enterBodyEdit = () => {
    setEditingBody(true);
    setSelectionMenu(null);
    setComposerOpen(false);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  };

  const leaveBodyEdit = () => {
    setEditingBody(false);
    setSelectionMenu(null);
    setComposerOpen(false);
    setDraftComment('');
  };

  const fetchNotepad = async () => {
    try {
      setLoading(true);
      const data = await api.personal.getNotepad();
      if (data.success) {
        const normalized = normalizeNotepadPayload(data.data);
        setNotes(normalized.notes);
        setActiveNoteId('');
        const ts = normalized.updatedAt ? new Date(normalized.updatedAt) : null;
        setLastSavedAt(ts && !Number.isNaN(ts.getTime()) ? ts : null);
        if (normalized.activeNoteId) {
          api.personal
            .saveNotepad({
              notes: normalized.notes.slice(0, MAX_NOTE_COUNT),
              activeNoteId: '',
              updatedAt: new Date().toISOString(),
            })
            .catch(() => null);
        }
      }
    } catch (error) {
      setStatus(error.message || '加载便签失败');
    } finally {
      setLoading(false);
    }
  };

  const doSave = async (nextNotes = notes, nextActiveNoteId = activeNoteId) => {
    setSaving(true);
    setStatus('');
    try {
      const payload = {
        notes: nextNotes.slice(0, MAX_NOTE_COUNT),
        activeNoteId: nextActiveNoteId || '',
        updatedAt: new Date().toISOString(),
      };
      const data = await api.personal.saveNotepad(payload);
      if (data.success) {
        setDirty(false);
        setStatus('已保存');
        const ts = data.data?.updatedAt ? new Date(data.data.updatedAt) : new Date();
        setLastSavedAt(ts);
      } else {
        setStatus(data.message || '保存失败');
      }
    } catch (error) {
      setStatus(error.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutosave = (nextNotes, nextActiveNoteId = activeNoteId) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      doSave(nextNotes, nextActiveNoteId);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const sortedNotes = useMemo(() => sortNotesForList(notes), [notes]);
  const recentNotes = useMemo(() => sortedNotes.slice(0, 8), [sortedNotes]);

  const activeComments = useMemo(() => {
    const list = Array.isArray(activeNote?.comments) ? activeNote.comments : [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [activeNote]);

  const upsertActiveNote = (updater) => {
    if (!activeNote) return;
    const nowIso = new Date().toISOString();
    const nextNotes = notes.map((note) => {
      if (note.id !== activeNote.id) return note;
      const patch = updater(note);
      return {
        ...note,
        ...patch,
        updatedAt: nowIso,
      };
    });
    setNotes(nextNotes);
    setDirty(true);
    setStatus('编辑中...');
    scheduleAutosave(nextNotes, activeNoteId);
  };

  const handleContentChange = (event) => {
    const nextValue = event.target.value;
    upsertActiveNote(() => ({ content: nextValue }));
    setSelectionMenu(null);
    setComposerOpen(false);
  };

  const handleTitleChange = (event) => {
    const nextTitle = event.target.value.slice(0, 120);
    upsertActiveNote(() => ({ title: nextTitle }));
  };

  const handleManualSave = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await doSave(notes, activeNoteId || '');
    // 保存后回到阅读态，鸟名/地点直接可点
    if (activeNoteId) leaveBodyEdit();
  };

  const handleCreateNote = () => {
    if (notes.length >= MAX_NOTE_COUNT) {
      setStatus(`最多可创建 ${MAX_NOTE_COUNT} 条便签`);
      return;
    }
    const newNote = createEmptyNote();
    const nextNotes = sortNotesForList([newNote, ...notes]);
    setNotes(nextNotes);
    setActiveNoteId(newNote.id);
    setEditingBody(true); // 新建先写字
    setDirty(true);
    setStatus('已创建新便签');
    scheduleAutosave(nextNotes, newNote.id);
  };

  const handleDeleteNote = async (noteId) => {
    if (notes.length <= 1) {
      setStatus('至少保留一条便签');
      return;
    }
    const ok = await ask('确定删除这条便签？删除后不能恢复。');
    if (!ok) return;
    const nextNotes = notes.filter((note) => note.id !== noteId);
    const nextActive = noteId === activeNoteId ? '' : activeNoteId;
    setNotes(nextNotes);
    setActiveNoteId(nextActive);
    setDirty(true);
    setStatus('便签已删除');
    scheduleAutosave(nextNotes, nextActive);
  };

  const handleSelectNote = (noteId) => {
    setActiveNoteId(noteId);
    scheduleAutosave(notes, noteId);
  };

  const handleCloseNote = () => {
    setActiveNoteId('');
    setStatus('已关闭便签');
    scheduleAutosave(notes, '');
  };

  const handleTogglePin = () => {
    if (!activeNote) return;
    const nextPinned = !activeNote.pinned;
    const nowIso = new Date().toISOString();
    const nextNotes = sortNotesForList(
      notes.map((note) =>
        note.id === activeNote.id
          ? { ...note, pinned: nextPinned, updatedAt: nowIso }
          : note
      )
    );
    setNotes(nextNotes);
    setDirty(true);
    setStatus(nextPinned ? '已置顶' : '已取消置顶');
    scheduleAutosave(nextNotes, activeNoteId);
  };

  const updateSelectionMenu = () => {
    const el = editorRef.current;
    const wrap = editorWrapRef.current;
    if (!el || !wrap) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || end == null || end <= start) {
      if (!composerOpen) setSelectionMenu(null);
      return;
    }
    const quote = el.value.slice(start, end);
    if (!quote.trim()) {
      if (!composerOpen) setSelectionMenu(null);
      return;
    }

    // 用镜像测量选区大致位置，气泡浮在编辑区上方
    const wrapRect = wrap.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const mirror = document.createElement('div');
    mirror.style.cssText = [
      'position:absolute',
      'visibility:hidden',
      'white-space:pre-wrap',
      'word-wrap:break-word',
      `width:${el.clientWidth}px`,
      `font:${style.font}`,
      `line-height:${style.lineHeight}`,
      `padding:${style.padding}`,
      `border:${style.border}`,
      `box-sizing:${style.boxSizing}`,
    ].join(';');
    const before = el.value.slice(0, start);
    const selected = el.value.slice(start, end);
    mirror.textContent = before;
    const mark = document.createElement('span');
    mark.textContent = selected || '|';
    mirror.appendChild(mark);
    document.body.appendChild(mirror);
    const markRect = mark.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);

    const top = markRect.top - mirrorRect.top - el.scrollTop + 8;
    const left = markRect.left - mirrorRect.left - el.scrollLeft + markRect.width / 2;
    setSelectionMenu({
      start,
      end,
      quote: quote.slice(0, 500),
      top: Math.max(8, Math.min(top, wrapRect.height - 40)),
      left: Math.max(40, Math.min(left, wrapRect.width - 40)),
    });
    setComposerOpen(false);
    setDraftComment('');
  };

  const handleEditorMouseUp = () => {
    // 等浏览器更新 selection
    requestAnimationFrame(updateSelectionMenu);
  };

  const handleEditorKeyUp = (event) => {
    if (event.shiftKey || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      requestAnimationFrame(updateSelectionMenu);
    }
  };

  const openCommentComposer = () => {
    if (!selectionMenu?.quote) return;
    setComposerOpen(true);
    setDraftComment('');
  };

  const handleSaveComment = () => {
    if (!activeNote || !selectionMenu) return;
    const body = draftComment.trim().slice(0, MAX_COMMENT_BODY);
    if (!body) {
      setStatus('请先写评论内容');
      return;
    }
    if ((activeNote.comments || []).length >= MAX_COMMENTS) {
      setStatus(`每条便签最多 ${MAX_COMMENTS} 条评论`);
      return;
    }
    const comment = {
      id: makeCommentId(),
      quote: selectionMenu.quote,
      start: selectionMenu.start,
      end: selectionMenu.end,
      body,
      createdAt: new Date().toISOString(),
    };
    upsertActiveNote((note) => ({
      comments: [comment, ...(Array.isArray(note.comments) ? note.comments : [])],
    }));
    setActiveCommentId(comment.id);
    setComposerOpen(false);
    setDraftComment('');
    setSelectionMenu(null);
    setStatus('评论已添加');
  };

  const handleDeleteComment = async (commentId) => {
    const ok = await ask('删除这条评论？');
    if (!ok) return;
    upsertActiveNote((note) => ({
      comments: (note.comments || []).filter((c) => c.id !== commentId),
    }));
    if (activeCommentId === commentId) setActiveCommentId('');
    setStatus('评论已删除');
  };

  const focusCommentQuote = (comment) => {
    if (!activeNote) return;
    const range = resolveCommentRange(activeNote.content, comment);
    setActiveCommentId(comment.id);
    if (!range.ok) {
      setStatus('原文已改，找不到这段文字了');
      return;
    }
    enterBodyEdit();
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(range.start, range.end);
      const ratio = range.start / Math.max(activeNote.content.length, 1);
      el.scrollTop = Math.max(0, el.scrollHeight * ratio - el.clientHeight / 3);
      setStatus('已定位到原文');
    });
  };

  const formatTime = (date) => {
    if (!date) return '尚未保存';
    const text = formatDisplayDateTime(date, { withSeconds: true });
    return text === '—' ? '尚未保存' : text;
  };

  return (
    <div className={styles.container}>
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="我的便签"
          description="计划与随手记"
          descriptionVariant="caption"
          actions={
            <HeaderPrimaryButton onClick={handleCreateNote} disabled={loading || notes.length >= MAX_NOTE_COUNT}>
              新建便签
            </HeaderPrimaryButton>
          }
        />

        {loading ? (
          <PageState type="loading" title="便签加载中..." />
        ) : (
          <section className={styles.panel}>
            <div className={styles.toolbar}>
              <div className={styles.meta}>
                <span className={styles.status}>{saving ? '保存中...' : status || '就绪'}</span>
                <span className={styles.savedTime}>最后保存：{formatTime(lastSavedAt)}</span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleManualSave}
                  disabled={saving || !dirty}
                >
                  {saving ? '保存中...' : '立即保存'}
                </button>
              </div>
            </div>

            <div className={styles.workspace}>
              <aside className={styles.noteList} aria-label="便签列表">
                {sortedNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={`${styles.noteItem} ${
                      note.id === activeNoteId ? styles.noteItemActive : ''
                    }${note.pinned ? ` ${styles.noteItemPinned}` : ''}`}
                    onClick={() => handleSelectNote(note.id)}
                  >
                    <span className={styles.noteItemTitle}>
                      {note.pinned ? <span className={styles.pinBadge}>置顶</span> : null}
                      {(note.title || '未命名便签').trim() || '未命名便签'}
                    </span>
                    <span className={styles.noteItemPreview}>
                      {(note.content || '').replace(/\s+/g, ' ').slice(0, 40) || '空白便签'}
                      {note.comments?.length
                        ? ` · ${note.comments.length} 评`
                        : ''}
                    </span>
                  </button>
                ))}
              </aside>

              <div className={styles.editorPane}>
                {activeNote ? (
                  <>
                    <div className={styles.editorHeader}>
                      <input
                        className={styles.titleInput}
                        value={activeNote.title}
                        onChange={handleTitleChange}
                        placeholder="便签标题"
                        aria-label="便签标题"
                      />
                      <div className={styles.editorHeaderActions}>
                        <button
                          type="button"
                          className={`${styles.closeButton}${
                            activeNote.pinned ? ` ${styles.pinButtonActive}` : ''
                          }`}
                          onClick={handleTogglePin}
                          aria-pressed={Boolean(activeNote.pinned)}
                        >
                          {activeNote.pinned ? '取消置顶' : '置顶'}
                        </button>
                        <button
                          type="button"
                          className={styles.closeButton}
                          onClick={handleCloseNote}
                        >
                          关闭
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => handleDeleteNote(activeNote.id)}
                          disabled={notes.length <= 1}
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <div className={styles.editorWithComments}>
                      <div className={styles.editorWrap} ref={editorWrapRef}>
                        {editingBody ? (
                          <>
                            <div className={styles.bodyModeBar}>
                              <span className={styles.bodyModeHint}>
                                编辑中 · 选中文字可评论 · 保存后鸟名/地点可点
                              </span>
                              <button
                                type="button"
                                className={styles.closeButton}
                                onClick={leaveBodyEdit}
                              >
                                完成
                              </button>
                            </div>
                            <textarea
                              ref={editorRef}
                              className={styles.editor}
                              value={activeNote.content}
                              onChange={handleContentChange}
                              onMouseUp={handleEditorMouseUp}
                              onKeyUp={handleEditorKeyUp}
                              onScroll={() => {
                                if (!composerOpen) setSelectionMenu(null);
                              }}
                              placeholder="在这里记录你想保存的信息...选中文字可添加评论"
                              aria-label="个人便签编辑器"
                            />

                            {selectionMenu && !composerOpen ? (
                              <button
                                type="button"
                                className={styles.commentBubbleBtn}
                                style={{ top: selectionMenu.top, left: selectionMenu.left }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={openCommentComposer}
                              >
                                评论
                              </button>
                            ) : null}

                            {selectionMenu && composerOpen ? (
                              <div
                                className={styles.commentComposer}
                                style={{ top: selectionMenu.top, left: selectionMenu.left }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <div className={styles.commentComposerQuote}>
                                  “{selectionMenu.quote.slice(0, 80)}
                                  {selectionMenu.quote.length > 80 ? '…' : ''}”
                                </div>
                                <textarea
                                  className={styles.commentComposerInput}
                                  value={draftComment}
                                  onChange={(e) =>
                                    setDraftComment(e.target.value.slice(0, MAX_COMMENT_BODY))
                                  }
                                  placeholder="写下这条评论…"
                                  rows={3}
                                  autoFocus
                                />
                                <div className={styles.commentComposerActions}>
                                  <button
                                    type="button"
                                    className={styles.closeButton}
                                    onClick={() => {
                                      setComposerOpen(false);
                                      setDraftComment('');
                                      setSelectionMenu(null);
                                    }}
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.saveButton}
                                    onClick={handleSaveComment}
                                  >
                                    添加
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div
                            className={styles.linkedBody}
                            onClick={enterBodyEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                enterBodyEdit();
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label="点击编辑正文"
                          >
                            {activeNote.content?.trim() ? (
                              <NotepadLinkedText text={activeNote.content} terms={linkTerms} />
                            ) : (
                              <span className={styles.linkedBodyEmpty}>
                                暂无正文，点击开始写…
                              </span>
                            )}
                            <span className={styles.linkedBodyTip}>
                              鸟名、地点可直接点开 · 点击空白处编辑
                            </span>
                          </div>
                        )}
                      </div>

                      <aside className={styles.commentPane} aria-label="评论列表">
                        <div className={styles.commentPaneHead}>
                          <h3 className={styles.commentPaneTitle}>评论</h3>
                          <span className={styles.commentPaneCount}>{activeComments.length}</span>
                        </div>
                        <p className={styles.commentPaneHint}>
                          {editingBody
                            ? '选中正文文字，点气泡添加评论'
                            : '点击正文进入编辑后，可选中文字评论'}
                        </p>
                        {activeComments.length === 0 ? (
                          <p className={styles.overviewEmpty}>还没有评论</p>
                        ) : (
                          <ul className={styles.commentList}>
                            {activeComments.map((c) => {
                              const range = resolveCommentRange(activeNote.content, c);
                              return (
                                <li
                                  key={c.id}
                                  className={`${styles.commentCard}${
                                    activeCommentId === c.id ? ` ${styles.commentCardActive}` : ''
                                  }${!range.ok ? ` ${styles.commentCardOrphan}` : ''}`}
                                >
                                  <button
                                    type="button"
                                    className={styles.commentCardMain}
                                    onClick={() => focusCommentQuote(c)}
                                  >
                                    <span className={styles.commentQuote}>
                                      “{c.quote || '（无引文）'}”
                                    </span>
                                    <span className={styles.commentBody}>{c.body}</span>
                                    <span className={styles.commentMeta}>
                                      {formatNoteTime(c.createdAt)}
                                      {!range.ok ? ' · 原文已变' : ''}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.commentDelete}
                                    onClick={() => handleDeleteComment(c.id)}
                                    aria-label="删除评论"
                                  >
                                    删
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </aside>
                    </div>
                  </>
                ) : (
                  <div className={styles.overview}>
                    <div className={styles.overviewHead}>
                      <h2 className={styles.overviewTitle}>便签概览</h2>
                      <p className={styles.overviewSub}>
                        共 {notes.length} 条。从左侧打开，或新建一条。关闭便签后会回到这里。
                      </p>
                    </div>

                    <div className={styles.overviewActions}>
                      <button type="button" className={styles.saveButton} onClick={handleCreateNote}>
                        新建便签
                      </button>
                    </div>

                    <div className={styles.overviewSection}>
                      <h3 className={styles.overviewSectionTitle}>最近更新</h3>
                      {recentNotes.length === 0 ? (
                        <p className={styles.overviewEmpty}>还没有便签。</p>
                      ) : (
                        <div className={styles.overviewGrid}>
                          {recentNotes.map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              className={styles.overviewCard}
                              onClick={() => handleSelectNote(note.id)}
                            >
                              <span className={styles.overviewCardTitle}>
                                {note.pinned ? (
                                  <span className={styles.pinBadge}>置顶</span>
                                ) : null}
                                {(note.title || '未命名便签').trim() || '未命名便签'}
                              </span>
                              <span className={styles.overviewCardPreview}>
                                {(note.content || '').replace(/\s+/g, ' ').slice(0, 72) ||
                                  '空白便签'}
                              </span>
                              <span className={styles.overviewCardMeta}>
                                {formatNoteTime(note.updatedAt) || '—'}
                                {note.comments?.length
                                  ? ` · ${note.comments.length} 条评论`
                                  : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
      {confirmDialog}
    </div>
  );
}

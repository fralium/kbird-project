'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SimplePageHeader from '../../components/SimplePageHeader';
import PageState from '../../components/PageState';
import AIImageUpload from '../../components/AIImageUpload';
import AIResult from '../../components/AIResult';
import { useAuth } from '../../components/AuthProvider';
import { api } from '../../utils/api';
import { getReadableAiError } from '../../utils/aiErrorMessages';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import styles from '../../styles/AIAssistant.module.css';

const MODES = [
  { id: 'general', label: '综合', hint: '认鸟、地点、知识都可以问。' },
  { id: 'identify', label: '认鸟', hint: '上传照片，或写外形、鸣声。' },
  { id: 'spots', label: '观鸟点', hint: '按地区和季节问适合去哪。' },
  { id: 'knowledge', label: '知识', hint: '习性、分类、保护等级。' },
];

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

const THINKING_OPTIONS = [
  { id: 'enabled', label: '深度思考', hint: '更准，较慢' },
  { id: 'auto', label: '自动', hint: '按题判断' },
  { id: 'disabled', label: '关闭', hint: '更快' },
];

const THINKING_STORAGE_KEY = 'kbird-ai-thinking';

function readStoredThinking() {
  if (typeof window === 'undefined') return 'enabled';
  try {
    const v = window.localStorage.getItem(THINKING_STORAGE_KEY);
    if (THINKING_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'enabled';
}

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AIAssistantPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const initialMode = (() => {
    const m = searchParams?.get('mode');
    return MODES.some((x) => x.id === m) ? m : 'general';
  })();

  const [mode, setMode] = useState(initialMode);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [conversation, setConversation] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [identifyResult, setIdentifyResult] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamDraft, setStreamDraft] = useState('');
  const [streamReasoning, setStreamReasoning] = useState('');
  const [thinking, setThinking] = useState('enabled');

  const messagesEndRef = useRef(null);
  const hasRedirectedRef = useRef(false);
  const streamAbortRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    setThinking(readStoredThinking());
  }, []);

  const handleThinkingChange = useCallback((next) => {
    if (!THINKING_OPTIONS.some((o) => o.id === next)) return;
    setThinking(next);
    try {
      window.localStorage.setItem(THINKING_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, streamDraft, streamStatus, streamReasoning, scrollToBottom]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const loadSessions = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api.ai.listConversations({ limit: '40' });
      if (data.success) {
        setSessions(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      setError(getReadableAiError(err?.code, err?.message || '加载历史失败'));
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.ai.getConversation(id);
      if (!data.success) {
        setError(data.message || '加载对话失败');
        return;
      }
      setConversation(data.data);
      setActiveId(String(data.data._id));
      setMode(data.data.mode || 'general');
      setIdentifyResult(null);
    } catch (err) {
      setError(getReadableAiError(err?.code, err?.message || '加载对话失败'));
    } finally {
      setBusy(false);
    }
  }, []);

  const startNew = useCallback(
    (nextMode = mode) => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setBusy(false);
      setError('');
      setIdentifyResult(null);
      setStreamStatus('');
      setStreamDraft('');
      setStreamReasoning('');
      setConversation(null);
      setActiveId('');
      setMode(nextMode);
      // 不落库：等用户真正发送/识别时再创建，避免一堆空对话
      router.replace(`/ai?mode=${nextMode}`, { scroll: false });
    },
    [mode, router]
  );

  useEffect(() => {
    if (authLoading) return;
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!user || !hasToken) {
      if (!hasToken && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.push('/login?redirect=/ai');
      }
      return;
    }

    (async () => {
      try {
        const status = await api.ai.getStatus();
        if (status.success) setAiStatus(status.data);
      } catch {
        // ignore
      }
      await loadSessions();
    })();
  }, [authLoading, user, router, loadSessions]);

  // URL ?c= conversation id
  useEffect(() => {
    const cid = searchParams?.get('c');
    if (cid && cid !== activeId) {
      loadConversation(cid);
    }
  }, [searchParams, activeId, loadConversation]);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode && !activeId) return;
    // 只切换场景，不创建空对话；左侧历史仍可回看旧记录
    startNew(nextMode);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;

    let convId = activeId;
    let baseConversation = conversation;
    if (!convId) {
      setBusy(true);
      try {
        const created = await api.ai.createConversation({ mode });
        if (!created.success) {
          setError(created.message || '创建对话失败');
          setBusy(false);
          return;
        }
        convId = String(created.data._id);
        setActiveId(convId);
        setConversation(created.data);
        baseConversation = created.data;
      } catch (err) {
        setError(getReadableAiError(err?.code, err?.message || '创建对话失败'));
        setBusy(false);
        return;
      }
    }

    setInput('');
    setBusy(true);
    setError('');
    setStreamStatus('已收到消息');
    setStreamDraft('');
    setStreamReasoning('');

    // 乐观展示用户气泡，等待期间也能看到信息在流动
    const optimisticUser = {
      _id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      kind: 'text',
    };
    setConversation((prev) => {
      const base = prev || baseConversation || { messages: [] };
      return {
        ...base,
        messages: [...(Array.isArray(base.messages) ? base.messages : []), optimisticUser],
      };
    });

    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      await api.ai.streamConversationMessage(
        convId,
        text,
        {
          onStatus: (payload) => {
            setStreamStatus(payload?.label || payload?.stage || '处理中…');
          },
          onReasoning: (payload) => {
            setStreamStatus('模型思考中…');
            if (payload?.text) {
              setStreamReasoning((prev) => (prev + payload.text).slice(-800));
            }
          },
          onDelta: (payload) => {
            setStreamStatus('正在生成回复…');
            if (payload?.text) {
              setStreamDraft((prev) => prev + payload.text);
            }
          },
          onDone: (payload) => {
            if (payload?.data) {
              setConversation(payload.data);
            }
          },
        },
        { signal: abortController.signal, thinking }
      );
      // 消息已成功落库；历史列表失败不应表现为「发送失败」
      try {
        await loadSessions();
      } catch {
        /* ignore */
      }
      router.replace(`/ai?mode=${mode}&c=${convId}`, { scroll: false });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const proxyOnly =
        err?.code === 'AI_CONVERSATION_STREAM_PROXY_FAILED' ||
        err?.code === 'BACKEND_UNREACHABLE' ||
        err?.code === 'AI_STREAM_UNSUPPORTED';
      if (proxyOnly) {
        try {
          setStreamStatus('改用完整请求…');
          const data = await api.ai.postConversationMessage(convId, text, { thinking });
          if (!data.success) {
            setError(data.message || '发送失败');
            return;
          }
          setConversation(data.data);
          try {
            await loadSessions();
          } catch {
            /* ignore */
          }
          router.replace(`/ai?mode=${data.data.mode || mode}&c=${convId}`, { scroll: false });
          return;
        } catch (fallbackErr) {
          setError(
            getReadableAiError(
              fallbackErr?.code || err?.code,
              fallbackErr?.message || err?.message || '发送失败'
            )
          );
          return;
        }
      }
      setError(getReadableAiError(err?.code, err?.message || '发送失败'));
    } finally {
      setBusy(false);
      setStreamStatus('');
      setStreamDraft('');
      setStreamReasoning('');
      streamAbortRef.current = null;
    }
  };

  const handleIdentifySuccess = async (result) => {
    setIdentifyResult(result);
    setError('');

    let convId = activeId;
    try {
      if (!convId || conversation?.mode !== 'identify') {
        const created = await api.ai.createConversation({ mode: 'identify' });
        if (!created.success) return;
        convId = String(created.data._id);
        setActiveId(convId);
        setMode('identify');
      }
      const saved = await api.ai.appendIdentifyResult(convId, {
        result,
        note: '上传照片请求识别',
      });
      if (saved.success) {
        setConversation(saved.data);
        await loadSessions();
        router.replace(`/ai?mode=identify&c=${convId}`, { scroll: false });
      }
    } catch (err) {
      setError(getReadableAiError(err?.code, err?.message || '识别结果未能写入历史'));
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    const ok = await ask('确定删除这条对话历史？');
    if (!ok) return;
    setBusy(true);
    try {
      await api.ai.deleteConversation(activeId);
      setConversation(null);
      setActiveId('');
      setIdentifyResult(null);
      await loadSessions();
      router.replace(`/ai?mode=${mode}`, { scroll: false });
    } catch (err) {
      setError(err.message || '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmIdentify = (selectedResult) => {
    const params = new URLSearchParams();
    const birdId = selectedResult.matchedBird?._id;
    if (birdId) params.set('birdId', birdId);
    else if (selectedResult.name) params.set('birdName', selectedResult.name);
    params.set('aiResult', JSON.stringify(selectedResult));
    router.push(`/records/add?${params.toString()}`);
  };

  const messages = useMemo(
    () => (Array.isArray(conversation?.messages) ? conversation.messages : []),
    [conversation]
  );

  if (authLoading) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.main}>
          <PageState type="loading" title="加载中" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.main}>
          <PageState
            type="empty"
            title="请先登录"
            message="登录后可用助手，对话会记在本机"
            actionLabel="去登录"
            onAction={() => router.push('/login?redirect=/ai')}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <SimplePageHeader
          title="观鸟助手"
          description="认鸟、地点和知识；对话留在本机"
          descriptionVariant="caption"
        />

        <div className="kb-view-bar" role="tablist" aria-label="助手场景">
          <div className="kb-view-seg">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={`kb-view-tab${mode === m.id ? ' is-active' : ''}`}
                onClick={() => handleModeChange(m.id)}
                disabled={busy}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="kb-view-hint">
            {(MODES.find((m) => m.id === mode) || MODES[0]).hint}
          </p>
        </div>

        {aiStatus ? (
          <section className={styles.providerPanel} aria-label="大模型与识别服务">
            <div className={styles.providerHead}>
              <h2 className={styles.providerTitle}>模型与服务</h2>
              <span className={styles.providerHint}>各用途当前走哪家接口</span>
            </div>
            <div className={styles.providerGrid}>
              {(Array.isArray(aiStatus.models) ? aiStatus.models : []).map((item) => (
                <div
                  key={item.id}
                  className={`${styles.providerCard} ${
                    item.enabled ? styles.providerCardOn : styles.providerCardOff
                  }`}
                >
                  <div className={styles.providerRole}>{item.roleLabel}</div>
                  <div className={styles.providerName}>{item.vendorName || '未命名'}</div>
                  <div className={styles.providerMeta}>
                    {item.model ? `模型 ${item.model}` : item.vendorBrand || '—'}
                    {' · '}
                    {item.enabled ? '已就绪' : '未配置'}
                  </div>
                </div>
              ))}
              {(!aiStatus.models || aiStatus.models.length === 0) && (
                <p className={styles.errorLine}>
                  尚未配置大模型。可在环境变量设置 OPENAI_API_KEY（豆包 / DeepSeek 等兼容接口）或
                  HHO_API_KEY（认鸟）。
                </p>
              )}
            </div>
          </section>
        ) : null}

        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <h2 className={styles.sidebarTitle}>历史</h2>
              <button
                type="button"
                className={styles.newBtn}
                onClick={() => startNew(mode)}
                disabled={busy}
              >
                新对话
              </button>
            </div>
            <div className={styles.historyList}>
              {listLoading ? (
                <p className={styles.historyEmpty}>加载中…</p>
              ) : sessions.length === 0 ? (
                <p className={styles.historyEmpty}>还没有对话</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    className={`${styles.historyItem} ${
                      String(s._id) === String(activeId) ? styles.historyItemActive : ''
                    }`}
                    onClick={() => {
                      router.replace(`/ai?mode=${s.mode}&c=${s._id}`, { scroll: false });
                      loadConversation(s._id);
                    }}
                  >
                    <span className={styles.historyTitle}>{s.title || '未命名'}</span>
                    <span className={styles.historyMeta}>
                      {MODE_LABEL[s.mode] || s.mode} · {formatTime(s.lastMessageAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={styles.chatPane}>
            <div className={styles.chatHead}>
              <h2 className={styles.chatTitle}>
                {conversation?.title || `${MODE_LABEL[mode] || '助手'}对话`}
              </h2>
              <div className={styles.chatActions}>
                {activeId ? (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={handleDelete}
                    disabled={busy}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.messages}>
              {!conversation ? (
                <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                  {mode === 'identify' &&
                    '上传照片认鸟，或直接描述外形/鸣声/地点。识别与追问都会记入历史。'}
                  {mode === 'spots' &&
                    '说说地区、季节或想看的鸟，我帮你梳理观鸟点思路与注意事项。'}
                  {mode === 'knowledge' &&
                    '可以问分类、习性、迁徙、保护等级或观鸟礼仪等。'}
                  {mode === 'general' &&
                    '认鸟、观鸟点、知识都可以问。点左侧历史可回看过往对话。'}
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m._id || `${m.role}-${m.createdAt}-${m.content?.slice(0, 12)}`}
                  className={`${styles.bubble} ${
                    m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                  } ${m.kind === 'identify_result' ? styles.bubbleIdentify : ''}`}
                >
                  {m.content}
                </div>
              ))}

              {busy && (streamStatus || streamDraft || streamReasoning) ? (
                <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleStreaming}`}>
                  {streamStatus ? (
                    <div className={styles.streamStatus} aria-live="polite">
                      <span className={styles.streamDot} />
                      {streamStatus}
                    </div>
                  ) : null}
                  {streamReasoning && !streamDraft ? (
                    <div className={styles.streamReasoning}>{streamReasoning}</div>
                  ) : null}
                  {streamDraft ? (
                    <div className={styles.streamText}>
                      {streamDraft}
                      <span className={styles.caret} aria-hidden="true" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.composer}>
              {mode === 'identify' ? (
                <div className={styles.identifyBox}>
                  <AIImageUpload
                    onIdentify={handleIdentifySuccess}
                    onError={(msg) => setError(msg)}
                    multiple={false}
                    resultContent={
                      identifyResult ? (
                        <AIResult
                          result={identifyResult}
                          onConfirm={handleConfirmIdentify}
                          onReject={() => setIdentifyResult(null)}
                        />
                      ) : null
                    }
                  />
                </div>
              ) : null}

              <div className={styles.thinkingRow} role="group" aria-label="思考模式">
                <span className={styles.thinkingLabel}>思考</span>
                {THINKING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.thinkingChip} ${
                      thinking === opt.id ? styles.thinkingChipActive : ''
                    }`}
                    onClick={() => handleThinkingChange(opt.id)}
                    disabled={busy}
                    title={opt.hint}
                  >
                    {opt.label}
                    <span className={styles.thinkingHint}>{opt.hint}</span>
                  </button>
                ))}
              </div>

              <div className={styles.inputRow}>
                <textarea
                  className={styles.textarea}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === 'spots'
                      ? '例如：四月本地湿地看鹬类，有公共交通…'
                      : mode === 'knowledge'
                        ? '例如：鸻鹬类迁徙高峰大概在什么时候？'
                        : mode === 'identify'
                          ? '补充描述，或追问易混淆种…'
                          : '输入你的问题…'
                  }
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={busy}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={busy || !input.trim()}
                >
                  {busy ? '…' : '发送'}
                </button>
              </div>
              {error ? <p className={styles.errorLine}>{error}</p> : null}
              {busy && streamStatus ? (
                <p className={styles.statusLine} aria-live="polite">
                  {streamStatus}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      {confirmDialog}
    </div>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <Navbar />
          <main className={styles.main}>
            <PageState type="loading" title="加载中" />
          </main>
          <Footer />
        </div>
      }
    >
      <AIAssistantPageInner />
    </Suspense>
  );
}

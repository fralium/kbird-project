export const RECORD_DRAFT_STORAGE_KEY = 'kbird-record-draft';

let replay = null;
let replayUntil = 0;

export function saveRecordDraft(form) {
  replay = null;
  replayUntil = 0;
  sessionStorage.setItem(RECORD_DRAFT_STORAGE_KEY, JSON.stringify(form || {}));
}

export function consumeRecordDraft() {
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  if (replay && now < replayUntil) return replay;

  try {
    const raw = sessionStorage.getItem(RECORD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RECORD_DRAFT_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    replay = parsed;
    replayUntil = now + 2000;
    return parsed;
  } catch {
    return null;
  }
}


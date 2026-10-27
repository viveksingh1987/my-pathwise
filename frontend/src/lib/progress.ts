import type { ProgressItem, ProgressState, TopicStatus } from "../types/models";

export const DEFAULT_PROGRESS: ProgressState = {
  items: {},
  settings: {},
  log: {},
  goal: 8,
};

export function normalizeProgress(raw: unknown): ProgressState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PROGRESS, items: {}, settings: {}, log: {} };
  }
  const s = raw as ProgressState;
  if (!s.items) {
    const o: Record<string, ProgressItem> = {};
    Object.keys(raw as object).forEach((k) => {
      o[k] = { done: 1 };
    });
    return { items: o, settings: {}, log: {}, goal: 8 };
  }
  s.settings = s.settings || {};
  s.log = s.log || {};
  s.goal = s.goal || 8;
  Object.keys(s.items).forEach((k) => {
    const it = s.items[k];
    if (it.min && !it.mins) it.mins = it.min;
    if (it.done && !it.st) it.st = "done";
  });
  return s;
}

export function topicStatus(item?: ProgressItem): TopicStatus {
  if (!item) return "todo";
  if (item.st) return item.st;
  if (item.done) return "done";
  if ((item.mins || 0) > 0) return "doing";
  return "todo";
}

export function ensureItem(
  items: Record<string, ProgressItem>,
  id: string,
): ProgressItem {
  if (!items[id]) items[id] = {};
  return items[id];
}

export function logMinutes(
  state: ProgressState,
  mins: number,
  topicId?: string,
  today = isoToday(),
): ProgressState {
  const next: ProgressState = {
    ...state,
    items: { ...state.items },
    log: { ...state.log },
  };
  next.log[today] = (next.log[today] || 0) + mins;
  if (topicId) {
    const it = ensureItem(next.items, topicId);
    it.mins = (it.mins || 0) + mins;
    if (topicStatus(it) === "todo") {
      it.st = "doing";
      it.done = 0;
    }
  }
  return next;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

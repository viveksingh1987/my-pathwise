import type { FilterKey, ProgressState, UiTopic } from "../types/models";
import { topicStatus } from "./progress";
import { iso } from "./dates";

export function matchesSearch(
  x: UiTopic,
  progress: ProgressState,
  query: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const s = progress.items[x.id] || {};
  return (
    x.t.toLowerCase().includes(q) ||
    (s.note || "").toLowerCase().includes(q) ||
    x.k.toLowerCase().includes(q)
  );
}

export function matchesTech(x: UiTopic, techFlt: string): boolean {
  if (!techFlt) return true;
  return x.tech.includes(techFlt);
}

export function matchesFilter(
  x: UiTopic,
  progress: ProgressState,
  flt: FilterKey,
  today = iso(new Date()),
): boolean {
  const s = progress.items[x.id] || {};
  const v = topicStatus(s);
  switch (flt) {
    case "todo":
      return v === "todo";
    case "doing":
      return v === "doing";
    case "open":
      return v !== "done";
    case "done":
      return v === "done";
    case "starred":
      return !!s.star;
    case "scheduled":
      return !!s.date;
    case "unscheduled":
      return !s.date;
    case "overdue":
      return v !== "done" && !!s.date && s.date < today;
    default:
      return true;
  }
}

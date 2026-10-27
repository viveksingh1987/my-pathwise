import type { ProgressState, UiTopic } from "../types/models";
import { iso, weekStart } from "./dates";
import { topicStatus } from "./progress";

export function monthStats(
  mn: number,
  allTopics: UiTopic[],
  progress: ProgressState,
): { total: number; done: number; star: number; mins: number; pct: number } {
  const L = allTopics.filter((x) => x.m === mn);
  let done = 0;
  let star = 0;
  let mins = 0;
  L.forEach((x) => {
    const s = progress.items[x.id] || {};
    if (topicStatus(s) === "done") done += 1;
    if (s.star) star += 1;
    mins += +(s.mins || 0) || 0;
  });
  return {
    total: L.length,
    done,
    star,
    mins,
    pct: L.length ? Math.round((done / L.length) * 100) : 0,
  };
}

export function aggregateStats(allTopics: UiTopic[], progress: ProgressState) {
  const T = iso(new Date());
  let done = 0;
  let sch = 0;
  let od = 0;
  let star = 0;
  let doing = 0;
  allTopics.forEach((x) => {
    const s = progress.items[x.id] || {};
    const v = topicStatus(s);
    if (v === "done") done += 1;
    if (v === "doing") doing += 1;
    if (s.date) sch += 1;
    if (s.star) star += 1;
    if (v !== "done" && s.date && s.date < T) od += 1;
  });
  const d = new Date();
  const ws = weekStart(d);
  const wk = iso(ws);
  let weekMins = 0;
  Object.keys(progress.log).forEach((k) => {
    if (k >= wk && k <= T) weekMins += progress.log[k];
  });
  let streak = 0;
  const c = new Date();
  if (!progress.log[iso(c)]) c.setDate(c.getDate() - 1);
  while ((progress.log[iso(c)] || 0) > 0 && streak < 999) {
    streak += 1;
    c.setDate(c.getDate() - 1);
  }
  const pct = allTopics.length ? Math.round((done / allTopics.length) * 100) : 0;
  return { done, doing, sch, od, star, weekMins, streak, pct, total: allTopics.length };
}

export type HeatCell = { key: string; level: number; title: string; hidden: boolean };

export function heatLevels(progress: ProgressState): HeatCell[] {
  const T = iso(new Date());
  const ws = weekStart(new Date());
  const cells: HeatCell[] = [];
  for (let i = 0; i < 84; i += 1) {
    const dd = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 77 + i);
    const k = iso(dd);
    const m = progress.log[k] || 0;
    const level = m >= 120 ? 4 : m >= 60 ? 3 : m >= 30 ? 2 : m > 0 ? 1 : 0;
    cells.push({
      key: k,
      level,
      title: `${k}: ${m}m`,
      hidden: k > T,
    });
  }
  return cells;
}

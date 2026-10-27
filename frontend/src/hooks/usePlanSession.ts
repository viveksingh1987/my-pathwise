import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/client";
import type { FilterKey, Plan, ProgressState, UiModule } from "../types/models";
import { matchesFilter, matchesSearch, matchesTech } from "../lib/filters";
import { flattenTopics, planMonthNow, planToModules } from "../lib/planModel";
import { ensureItem, logMinutes, normalizeProgress, topicStatus } from "../lib/progress";
import { pageTitle } from "../constants/brand";
import { iso } from "../lib/dates";

const PROGRESS_KEY_PREFIX = "progress-v3:";

export function usePlanSession(slug: string, onToast: (msg: string) => void) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [modules, setModules] = useState<UiModule[]>([]);
  const [progress, setProgress] = useState<ProgressState>(() => normalizeProgress(null));
  const [apiOnline, setApiOnline] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [techFlt, setTechFlt] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState("");
  const saveTimer = useRef<number | undefined>(undefined);

  const allTopics = useMemo(() => flattenTopics(modules), [modules]);

  const applyPlan = useCallback((p: Plan) => {
    setPlan(p);
    setModules(planToModules(p));
    document.title = pageTitle(p.title);
  }, []);

  const reloadPlan = useCallback(async () => {
    const p = await api.fetchPlan(slug);
    applyPlan(p);
    return p;
  }, [applyPlan, slug]);

  const persist = useCallback(
    (next: ProgressState) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const body = {
          items: next.items,
          log: next.log,
          goal: next.goal,
          settings: next.settings,
        };
        if (apiOnline) {
          api.saveProgress(slug, body).catch(() => onToast("Could not save progress"));
        } else {
          try {
            localStorage.setItem(PROGRESS_KEY_PREFIX + slug, JSON.stringify(body));
          } catch {
            /* ignore */
          }
        }
        const lbl = apiOnline ? "Progress saved" : "Progress saved in this browser";
        setSavedLabel(lbl);
        onToast(lbl);
      }, 400);
    },
    [apiOnline, onToast, slug],
  );

  const updateProgress = useCallback(
    (updater: (prev: ProgressState) => ProgressState) => {
      setProgress((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.fetchPlan(slug);
        if (cancelled) return;
        applyPlan(p);
        const prog = await api.fetchProgress(slug);
        if (cancelled) return;
        setApiOnline(true);
        const norm = normalizeProgress(prog);
        setProgress(norm);
        const mn = planMonthNow(slug, planToModules(p));
        if (!norm.settings.collapsed || !Object.keys(norm.settings.collapsed).length) {
          const collapsed: Record<string, boolean> = {};
          planToModules(p).forEach((m) => {
            if (m.n !== mn) collapsed[`m${m.n}`] = true;
          });
          setProgress((prev) => ({ ...prev, settings: { ...prev.settings, collapsed } }));
        }
      } catch {
        setApiOnline(false);
        try {
          const raw = localStorage.getItem(PROGRESS_KEY_PREFIX + slug);
          setProgress(normalizeProgress(raw ? JSON.parse(raw) : null));
        } catch {
          setProgress(normalizeProgress(null));
        }
        onToast("Offline — progress only in this browser");
        api.fetchPlan(slug).then(applyPlan).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPlan, onToast, slug]);

  const visibleTopics = useCallback(
    (month: number) =>
      allTopics.filter(
        (x) =>
          x.m === month &&
          matchesFilter(x, progress, filter) &&
          matchesSearch(x, progress, search) &&
          matchesTech(x, techFlt),
      ),
    [allTopics, filter, progress, search, techFlt],
  );

  const toggleCollapse = useCallback(
    (mn: number) => {
      updateProgress((prev) => {
        const collapsed = { ...(prev.settings.collapsed || {}) };
        const key = `m${mn}`;
        collapsed[key] = !collapsed[key];
        return { ...prev, settings: { ...prev.settings, collapsed } };
      });
    },
    [updateProgress],
  );

  const isCollapsed = useCallback(
    (mn: number) => !!progress.settings.collapsed?.[`m${mn}`],
    [progress.settings.collapsed],
  );

  const patchTopic = useCallback(
    (id: string, patch: Partial<ProgressState["items"][string]>) => {
      updateProgress((prev) => {
        const items = { ...prev.items };
        const it = ensureItem(items, id);
        Object.assign(it, patch);
        return { ...prev, items };
      });
    },
    [updateProgress],
  );

  const cycleStatus = useCallback(
    (id: string) => {
      updateProgress((prev) => {
        const items = { ...prev.items };
        const it = ensureItem(items, id);
        const cur = topicStatus(it);
        const next = cur === "todo" ? "doing" : cur === "doing" ? "done" : "todo";
        it.st = next;
        it.done = next === "done" ? 1 : 0;
        return { ...prev, items };
      });
    },
    [updateProgress],
  );

  const logMin = useCallback(
    (mins: number, topicId?: string) => {
      updateProgress((prev) => logMinutes(prev, mins, topicId));
    },
    [updateProgress],
  );

  const removeTopic = useCallback(
    async (topicId: string) => {
      if (!apiOnline) {
        onToast("Connect to server to delete topics");
        return;
      }
      await api.deleteTopic(slug, topicId);
      updateProgress((prev) => {
        const items = { ...prev.items };
        delete items[topicId];
        return { ...prev, items };
      });
      await reloadPlan();
      onToast("Topic removed");
    },
    [apiOnline, onToast, reloadPlan, slug, updateProgress],
  );

  const autoSchedule = useCallback(() => {
    updateProgress((prev) => {
      const items = { ...prev.items };
      modules.forEach((m) => {
        const mo = 10 + m.n - 1;
        const days = new Date(2026, mo + 1, 0).getDate();
        const open = allTopics.filter(
          (x) => x.m === m.n && !(items[x.id] || {}).date,
        );
        open.forEach((x, i) => {
          const it = ensureItem(items, x.id);
          it.date = iso(
            new Date(2026, mo, 1 + Math.floor(((i + 0.5) * days) / open.length)),
          );
        });
      });
      return { ...prev, items };
    });
    onToast("Dates assigned across each month");
  }, [allTopics, modules, onToast, updateProgress]);

  const techTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: string[] = [];
    modules.forEach((m) =>
      m.tech.forEach((t) => {
        if (!seen.has(t)) {
          seen.add(t);
          tags.push(t);
        }
      }),
    );
    return tags;
  }, [modules]);

  return {
    plan,
    modules,
    progress,
    setProgress: updateProgress,
    apiOnline,
    filter,
    setFilter,
    search,
    setSearch,
    techFlt,
    setTechFlt,
    selectedTopicId,
    setSelectedTopicId,
    savedLabel,
    allTopics,
    visibleTopics,
    toggleCollapse,
    isCollapsed,
    patchTopic,
    cycleStatus,
    logMin,
    removeTopic,
    autoSchedule,
    reloadPlan,
    techTags,
    slug,
  };
}

import type { Plan, UiModule, UiTopic } from "../types/models";

export function planToModules(plan: Plan): UiModule[] {
  return (plan.modules || [])
    .map((mod) => ({
      n: mod.sort_order,
      moduleId: mod.id,
      t: mod.period_label || "",
      h: mod.heading || "",
      g: mod.goal || "",
      p: mod.project || "",
      tech: mod.tech || [],
      topics: (mod.topics || [])
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((t) => ({
          id: t.id,
          t: t.title,
          u: t.url || "",
          k: t.kind || "Topic",
          note: t.description || "",
        })),
    }))
    .sort((a, b) => a.n - b.n);
}

export function flattenTopics(modules: UiModule[]): UiTopic[] {
  const list: UiTopic[] = [];
  modules.forEach((m) => {
    m.topics.forEach((x) => {
      list.push({
        id: x.id,
        m: m.n,
        moduleId: m.moduleId,
        t: x.t,
        u: x.u,
        k: x.k,
        note: x.note,
        tech: m.tech,
      });
    });
  });
  return list;
}

export function planMonthNow(slug: string, modules: UiModule[]): number {
  if (!modules.length) return 1;
  if (slug === "ai-engineer") {
    const n = new Date();
    const y = n.getFullYear();
    const mo = n.getMonth();
    if (y === 2026 && mo >= 10) return 1;
    if (y === 2027 && mo <= 3) return mo - 10;
    if (y < 2026 || (y === 2026 && mo < 10)) return 1;
    return 6;
  }
  return modules[0].n;
}

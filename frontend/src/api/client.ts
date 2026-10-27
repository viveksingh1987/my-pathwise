import type { HomeDomain, Plan, ProgressState } from "../types/models";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchHome(): Promise<HomeDomain[]> {
  return parseJson(await fetch("/api/home"));
}

export async function createPlan(body: {
  title: string;
  subtitle?: string;
  lead?: string;
}): Promise<Plan> {
  return parseJson(
    await fetch("/api/plans", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  );
}

export async function deletePlan(slug: string): Promise<void> {
  const res = await fetch(`/api/plans/${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
}

export async function fetchPlan(slug: string): Promise<Plan> {
  return parseJson(await fetch(`/api/plans/${encodeURIComponent(slug)}`));
}

export async function fetchProgress(slug: string): Promise<ProgressState> {
  return parseJson(await fetch(`/api/plans/${encodeURIComponent(slug)}/progress`));
}

export async function saveProgress(slug: string, data: ProgressState): Promise<void> {
  const res = await fetch(`/api/plans/${encodeURIComponent(slug)}/progress`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("save failed");
}

export async function createModule(
  slug: string,
  body: { heading: string; period_label?: string; goal?: string; tech?: string },
): Promise<unknown> {
  return parseJson(
    await fetch(`/api/plans/${encodeURIComponent(slug)}/modules`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  );
}

export async function createTopic(
  slug: string,
  body: { module_id: string; title: string; url?: string; kind?: string },
): Promise<unknown> {
  return parseJson(
    await fetch(`/api/plans/${encodeURIComponent(slug)}/topics`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteTopic(slug: string, topicId: string): Promise<void> {
  const res = await fetch(
    `/api/plans/${encodeURIComponent(slug)}/topics/${encodeURIComponent(topicId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("delete failed");
}

export type TopicStatus = "todo" | "doing" | "done";

export interface ProgressItem {
  st?: TopicStatus;
  done?: number;
  mins?: number;
  min?: number;
  note?: string;
  date?: string;
  star?: number;
}

export interface ProgressSettings {
  collapsed?: Record<string, boolean>;
  theme?: string;
}

export interface ProgressState {
  items: Record<string, ProgressItem>;
  settings: ProgressSettings;
  log: Record<string, number>;
  goal: number;
}

export interface PlanTopic {
  id: string;
  title: string;
  url?: string;
  kind?: string;
  description?: string;
  sort_order?: number;
}

export interface PlanModule {
  id: string;
  sort_order: number;
  period_label?: string;
  heading?: string;
  goal?: string;
  project?: string;
  tech?: string[];
  topics?: PlanTopic[];
}

export interface Plan {
  slug: string;
  title: string;
  subtitle?: string;
  lead?: string;
  modules?: PlanModule[];
}

export interface HomeDomain {
  slug: string;
  title: string;
  subtitle?: string;
  lead?: string;
  percent_done: number;
  topics_done: number;
  topics_total: number;
  sections: number;
}

export interface UiTopic {
  id: string;
  m: number;
  moduleId: string;
  t: string;
  u: string;
  k: string;
  note: string;
  tech: string[];
}

export interface UiModule {
  n: number;
  moduleId: string;
  t: string;
  h: string;
  g: string;
  p: string;
  tech: string[];
  topics: Array<{ id: string; t: string; u: string; k: string; note: string }>;
}

export type FilterKey =
  | "all"
  | "todo"
  | "doing"
  | "open"
  | "done"
  | "starred"
  | "scheduled"
  | "unscheduled"
  | "overdue";

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(d: string): string {
  return new Date(`${d}T00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function formatMinutes(mins: number): string {
  const m = mins || 0;
  return m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`
    : `${m}m`;
}

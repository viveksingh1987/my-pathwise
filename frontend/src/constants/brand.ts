/** Application display name */
export const APP_NAME = "My Pathwise";

export function pageTitle(planTitle?: string): string {
  if (planTitle) return `${planTitle} · ${APP_NAME}`;
  return APP_NAME;
}

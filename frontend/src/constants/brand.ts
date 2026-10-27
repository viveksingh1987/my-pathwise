/** Application display name */
export const APP_NAME = "My Pathwise";

/** Short product description for marketing and footer copy. */
export const APP_TAGLINE =
  "Track modules, topics, notes, and study time for any learning plan.";

/** Semantic version shown in the footer (keep in sync with package.json). */
export const APP_VERSION = "2.0.0";

/** Static app icons (served from `frontend/public/icons`). */
export const APP_ICON_SVG = "/icons/mypathwise-icon.svg";
export const APP_ICON_32 = "/icons/mypathwise-icon-32.png";
export const APP_ICON_192 = "/icons/mypathwise-icon-192.png";
export const APP_ICON_512 = "/icons/mypathwise-icon-512.png";

export function pageTitle(planTitle?: string): string {
  if (planTitle) return `${planTitle} · ${APP_NAME}`;
  return APP_NAME;
}

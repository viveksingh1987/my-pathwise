import { useCallback, useEffect } from "react";

const THEME_KEY = "ai-roadmap-theme";

export function useTheme(onPersist?: (theme: "light" | "dark") => void) {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const dark =
      cur !== "light" &&
      (cur === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    onPersist?.(next);
  }, [onPersist]);

  return { toggleTheme: toggle };
}

import { useState } from "react";

export const THEMES = ["dark", "light", "ember", "fresh", "invit", "glass"];
export const THEME_ICONS = { dark: "🌙", light: "☀️", ember: "🔥", fresh: "✨", invit: "🌸", glass: "💎" };

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "glass");

  function apply(next) {
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function toggle() {
    apply(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  }

  function select(next) {
    if (THEMES.includes(next)) apply(next);
  }

  return { theme, icon: THEME_ICONS[theme], toggle, select };
}

import { useState } from "react";

const THEMES = ["dark", "light", "ember"];
const ICONS  = { dark: "🌙", light: "☀️", ember: "🔥" };

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "dark");

  function toggle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return { theme, icon: ICONS[theme], toggle };
}

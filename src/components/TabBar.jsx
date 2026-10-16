import { IconHome, IconHistory, IconProgress, IconTools, IconStart } from "./icons";

/*
 * Flikikonerna är inline-SVG, inte emoji. Emoji renderas i fullfärg av
 * operativsystemet och går inte att färgsätta via tokens — SVG med
 * currentColor ärver --fg-3 / --text / --accent-ink, så färgen får markera
 * aktiv flik tillsammans med accentpricken.
 */
const TABS = [
  { id: "home", label: "Hem", Icon: IconHome },
  { id: "history", label: "Historik", Icon: IconHistory },
  null, // raised center slot
  { id: "progress", label: "Utveckling", Icon: IconProgress },
  { id: "tools", label: "Verktyg", Icon: IconTools },
];

function isActive(tabId, view) {
  // "edit" is a sub-view of the home tab, so the home tab stays lit there
  if (tabId === "home") return view === "home" || view === "edit";
  return view === tabId;
}

export default function TabBar({ view, hasActiveSession, onNavigate, onStart }) {
  const centerActive = view === "session";

  return (
    <nav className="tabbar" aria-label="Huvudnavigering">
      {TABS.map((tab) =>
        tab === null ? (
          <button
            key="center"
            type="button"
            className={`tab tab--center${centerActive ? " tab--active" : ""}`}
            onClick={onStart}
            aria-current={centerActive ? "page" : undefined}
            title={hasActiveSession ? "Till pågående pass" : "Starta ett pass"}
          >
            <span className="tab-fab"><IconStart /></span>
            <span className="tab-label">{hasActiveSession ? "Pass" : "Starta"}</span>
          </button>
        ) : (
          <button
            key={tab.id}
            type="button"
            className={`tab${isActive(tab.id, view) ? " tab--active" : ""}`}
            onClick={() => onNavigate(tab.id)}
            aria-current={isActive(tab.id, view) ? "page" : undefined}
          >
            <span className="tab-icon"><tab.Icon /></span>
            <span className="tab-label">{tab.label}</span>
          </button>
        )
      )}
    </nav>
  );
}

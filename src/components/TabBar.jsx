const TABS = [
  { id: "home", label: "Hem", icon: "🏠" },
  { id: "history", label: "Historik", icon: "📋" },
  null, // raised center slot
  { id: "progress", label: "Utveckling", icon: "📈" },
  { id: "tools", label: "Verktyg", icon: "🧰" },
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
            <span className="tab-fab" aria-hidden="true">▶</span>
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
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        )
      )}
    </nav>
  );
}

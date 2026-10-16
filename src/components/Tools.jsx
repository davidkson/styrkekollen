import PlateCalculator from "./PlateCalculator";
import { THEMES, THEME_ICONS } from "../hooks/useTheme";

const THEME_LABELS = {
  dark: "Mörkt",
  light: "Ljust",
  ember: "Ember",
  fresh: "Fresh",
  invit: "Invit",
  glass: "Glas",
};

export default function Tools({ theme, onSelectTheme, onLogout }) {
  return (
    <div className="tools">
      <div className="session-header">
        <span />
        <h2>Verktyg</h2>
        <span />
      </div>

      <section className="tools-section">
        <h3 className="tools-section-title">Skivkalkylator</h3>
        <div className="tools-card">
          <PlateCalculator />
        </div>
      </section>

      <section className="tools-section">
        <h3 className="tools-section-title">Tema</h3>
        <div className="tools-theme-grid">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className={`tools-theme${t === theme ? " tools-theme--active" : ""}`}
              onClick={() => onSelectTheme(t)}
            >
              <span className="tools-theme-icon" aria-hidden="true">{THEME_ICONS[t]}</span>
              <span>{THEME_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tools-section">
        <h3 className="tools-section-title">Konto</h3>
        <button type="button" className="tools-logout" onClick={onLogout}>
          Logga ut
        </button>
      </section>
    </div>
  );
}

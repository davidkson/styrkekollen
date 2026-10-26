import { useRef, useState } from "react";
import PlateCalculator from "./PlateCalculator";
import { parseBackup, importSummary } from "../lib/backup";
import { THEMES, THEME_ICONS } from "../hooks/useTheme";

const THEME_LABELS = {
  dark: "Mörkt",
  light: "Ljust",
  ember: "Ember",
  fresh: "Fresh",
  invit: "Invit",
  glass: "Glas",
};

export default function Tools({ theme, onSelectTheme, onExportBackup, onImportBackup, onLogout }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState(null); // { text, error }

  async function handleExport() {
    setStatus(null);
    try {
      await onExportBackup();
    } catch {
      setStatus({ text: "Exporten misslyckades.", error: true });
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setStatus(null);
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (err) {
      setStatus({ text: `${err.message} Inget importerades.`, error: true });
      return;
    }
    setImporting(true);
    try {
      const { counts, error } = await onImportBackup(backup);
      setStatus(error
        ? { text: `Importen avbröts av ett fel. ${importSummary(counts)} Försök igen för att importera resten.`, error: true }
        : { text: importSummary(counts), error: false });
    } finally {
      setImporting(false);
    }
  }

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
        <h3 className="tools-section-title">Backup</h3>
        <div className="tools-card tools-backup">
          <p className="tools-backup-hint">
            All data som en JSON-fil. Importen lägger bara till det som saknas.
          </p>
          <div className="tools-backup-actions">
            <button type="button" className="tools-backup-btn" onClick={handleExport} disabled={importing}>
              Exportera backup
            </button>
            <button
              type="button"
              className="tools-backup-btn"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importerar…" : "Importera backup"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            hidden
          />
          {status && (
            <p className={`tools-backup-status${status.error ? " tools-backup-status--error" : ""}`} role="status">
              {status.text}
            </p>
          )}
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

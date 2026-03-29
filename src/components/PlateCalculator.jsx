import { useState } from "react";

const BAR_WEIGHT = 17;
const PLATES = [20, 15, 10, 5, 2.5, 1.25, 0.5];

function calcPlates(target) {
  const perSide = (target - BAR_WEIGHT) / 2;
  if (perSide < 0) return null;
  const result = [];
  let remaining = Math.round(perSide * 1000) / 1000;
  for (const plate of PLATES) {
    if (remaining <= 0) break;
    const count = Math.floor(Math.round((remaining / plate) * 1000) / 1000);
    if (count > 0) {
      result.push({ plate, count });
      remaining = Math.round((remaining - plate * count) * 1000) / 1000;
    }
  }
  if (remaining > 0.001) return null;
  return result;
}

export default function PlateCalculator() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("calc"); // "calc" | "build"

  // calc mode
  const [target, setTarget] = useState("");

  // build mode: { [plate]: count }
  const [selected, setSelected] = useState({});

  const parsed = parseFloat(target);
  const valid = !isNaN(parsed) && parsed >= BAR_WEIGHT;
  const calcResult = valid ? calcPlates(parsed) : null;
  const calcPerSide = valid ? (parsed - BAR_WEIGHT) / 2 : null;

  const buildPerSide = PLATES.reduce((sum, p) => sum + p * (selected[p] ?? 0), 0);
  const buildTotal = Math.round((BAR_WEIGHT + buildPerSide * 2) * 1000) / 1000;

  function adjust(plate, delta) {
    setSelected((prev) => {
      const next = Math.max(0, (prev[plate] ?? 0) + delta);
      return { ...prev, [plate]: next };
    });
  }

  const buildPlates = PLATES.filter((p) => (selected[p] ?? 0) > 0).map((p) => ({ plate: p, count: selected[p] }));

  return (
    <div className="plate-calc-wrapper">
      {open && (
        <div className="plate-panel">
          <div className="plate-panel-header">
            <span>Viktkalkylator</span>
            <button className="plate-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="plate-body">
          <div className="plate-tabs">
            <button className={`plate-tab ${mode === "calc" ? "plate-tab-active" : ""}`} onClick={() => setMode("calc")}>
              Vikt → Skivor
            </button>
            <button className={`plate-tab ${mode === "build" ? "plate-tab-active" : ""}`} onClick={() => setMode("build")}>
              Skivor → Vikt
            </button>
          </div>

          {mode === "calc" && (
            <>
              <div className="plate-input-row">
                <input
                  type="number"
                  className="plate-input"
                  placeholder="Målvikt (kg)"
                  value={target}
                  min={BAR_WEIGHT}
                  step="0.5"
                  autoFocus
                  onChange={(e) => setTarget(e.target.value)}
                />
                <span className="plate-bar-label">Stång: {BAR_WEIGHT} kg</span>
              </div>
              {target !== "" && (
                <div className="plate-result">
                  {!valid && <p className="plate-error">Ange en vikt ≥ {BAR_WEIGHT} kg</p>}
                  {valid && calcResult === null && <p className="plate-error">Kan inte nås exakt med tillgängliga skivor</p>}
                  {valid && calcResult !== null && (
                    <>
                      <div className="plate-per-side">
                        {calcPerSide === 0 ? "Bara stången" : `${calcPerSide} kg per sida`}
                      </div>
                      {calcResult.length === 0 ? (
                        <p className="plate-empty">Inga skivor — bara stången</p>
                      ) : (
                        <div className="plate-chips">
                          {calcResult.map(({ plate, count }) => (
                            <div key={plate} className="plate-chip">
                              <span className="plate-chip-weight">{plate} kg</span>
                              <span className="plate-chip-count">× {count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <PlateVisual plates={calcResult} />
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "build" && (
            <>
              <div className="build-total">
                <span className="build-total-label">Totalvikt</span>
                <span className="build-total-value">{buildTotal} kg</span>
                {buildPerSide > 0 && (
                  <span className="build-total-side">{buildPerSide} kg / sida</span>
                )}
              </div>
              <div className="build-plates">
                {PLATES.map((plate) => {
                  const count = selected[plate] ?? 0;
                  return (
                    <div key={plate} className="build-row">
                      <span className="build-plate-label">{plate} kg</span>
                      <div className="build-controls">
                        <button className="build-btn" onClick={() => adjust(plate, -1)} disabled={count === 0}>−</button>
                        <span className="build-count">{count}</span>
                        <button className="build-btn" onClick={() => adjust(plate, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {buildPlates.length > 0 && (
                <>
                  <PlateVisual plates={buildPlates} />
                  <button className="build-reset" onClick={() => setSelected({})}>Rensa</button>
                </>
              )}
            </>
          )}
          </div>
        </div>
      )}
      <button
        className={`plate-fab ${open ? "plate-fab-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Viktkalkylator"
      >
        🏋️
      </button>
    </div>
  );
}

function PlateVisual({ plates }) {
  return (
    <div className="plate-visual">
      {plates.flatMap(({ plate, count }) =>
        Array.from({ length: count }, (_, i) => (
          <div
            key={`${plate}-${i}`}
            className="plate-disc"
            style={{ "--h": `${Math.max(20, Math.min(64, plate * 3))}px` }}
          >
            {plate}
          </div>
        ))
      )}
      <div className="plate-bar-end" />
    </div>
  );
}

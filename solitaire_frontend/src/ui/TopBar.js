import React, { useState } from "react";

// PUBLIC_INTERFACE
export function TopBar({
  theme,
  onToggleTheme,
  onNewGame,
  onUndo,
  onHint,
  onExport,
  onImport,
}) {
  /** Top app bar with brand and overflow actions. */
  const [open, setOpen] = useState(false);

  return (
    <header className="TopBar" data-no-board-clear>
      <div className="TopBarInner">
        <div className="Brand" aria-label="Mobile Solitaire Pro">
          <div className="BrandTitle">Mobile Solitaire</div>
          <div className="BrandSub">Ocean Professional</div>
        </div>

        <div className="Actions">
          <button className="Btn BtnIcon" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "ocean" ? "🌙" : "☀️"}
          </button>
          <button className="Btn BtnPrimary" onClick={onNewGame}>
            New
          </button>
          <button className="Btn" onClick={onUndo}>
            Undo
          </button>

          <button className="Btn BtnIcon" onClick={() => setOpen((v) => !v)} aria-label="More actions">
            ⋯
          </button>
        </div>
      </div>

      {open ? (
        <div style={{ maxWidth: 980, margin: "10px auto 0", padding: "0 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="Btn BtnSecondary" onClick={() => (setOpen(false), onHint())}>
            Hint
          </button>
          <button className="Btn" onClick={() => (setOpen(false), onExport())}>
            Export
          </button>
          <button className="Btn" onClick={() => (setOpen(false), onImport())}>
            Import
          </button>
        </div>
      ) : null}
    </header>
  );
}

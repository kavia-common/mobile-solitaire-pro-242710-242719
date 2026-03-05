import React from "react";

// PUBLIC_INTERFACE
export function BottomBar({ stockCount, wasteCount, moves, score, onNewGame, onUndo, onHint }) {
  /** Fixed bottom control bar optimized for thumb reach. */
  return (
    <footer className="BottomBar" data-no-board-clear>
      <div className="BottomBarInner">
        <div className="Stats" aria-label="Game stats">
          <div className="Stat">
            Stock <strong>{stockCount}</strong>
          </div>
          <div className="Stat">
            Waste <strong>{wasteCount}</strong>
          </div>
          <div className="Stat">
            Moves <strong>{moves}</strong>
          </div>
          <div className="Stat">
            Score <strong>{score}</strong>
          </div>
        </div>

        <div className="BottomActions" aria-label="Controls">
          <button className="Btn BtnPrimary" onClick={onHint}>
            Hint
          </button>
          <button className="Btn" onClick={onUndo}>
            Undo
          </button>
          <button className="Btn" onClick={onNewGame}>
            New
          </button>
        </div>
      </div>
    </footer>
  );
}

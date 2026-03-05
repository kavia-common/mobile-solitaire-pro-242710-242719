import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  createNewGame,
  getLegalMovesForCard,
  getTopCardId,
  isGameWon,
  moveCardGroup,
  moveToFoundationIfLegal,
  recycleWasteToStock,
  revealIfNeeded,
  scoreAfterMove,
  serializeGame,
  tryAutoMoveToFoundation,
  undo,
  unserializeGame,
} from "./game/engine";
import { loadState, saveState } from "./game/persistence";
import { usePress } from "./hooks/usePress";
import { announce, useLiveRegion } from "./hooks/useLiveRegion";
import { Card } from "./ui/Card";
import { TopBar } from "./ui/TopBar";
import { BottomBar } from "./ui/BottomBar";
import { Toast } from "./ui/Toast";

/**
 * The main Solitaire SPA: renders the game board, handles touch-first interactions,
 * persists state to localStorage, and provides PWA-friendly layout.
 */
export default function App() {
  const [theme, setTheme] = useState(() => loadState().theme || "ocean");
  const [game, setGame] = useState(() => loadState().game || createNewGame());
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [toast, setToast] = useState(null);
  const live = useLiveRegion();

  const lastTapRef = useRef({ cardId: null, t: 0 });

  // Apply theme at root.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Persist to localStorage (debounced by requestAnimationFrame-ish batching via microtask).
  useEffect(() => {
    const payload = { theme, game };
    const id = window.setTimeout(() => saveState(payload), 50);
    return () => window.clearTimeout(id);
  }, [theme, game]);

  const won = useMemo(() => isGameWon(game), [game]);

  useEffect(() => {
    if (won) {
      setToast({ tone: "success", message: "You won! New game?" });
      announce(live, "Congratulations! You won the game.");
    }
  }, [won, live]);

  // --- Action helpers -------------------------------------------------------

  function clearSelection() {
    setSelectedCardId(null);
  }

  function selectCard(cardId) {
    setSelectedCardId(cardId);
  }

  function showError(msg) {
    setToast({ tone: "error", message: msg });
    announce(live, msg);
  }

  function showInfo(msg) {
    setToast({ tone: "info", message: msg });
    announce(live, msg);
  }

  // PUBLIC_INTERFACE
  function onNewGame() {
    /** Start a fresh game and reset selection/notifications. */
    const next = createNewGame();
    setGame(next);
    clearSelection();
    setToast({ tone: "info", message: "New game started." });
    announce(live, "New game started.");
  }

  // PUBLIC_INTERFACE
  function onUndo() {
    /** Undo the last move, if possible. */
    const next = undo(game);
    if (next === game) {
      showInfo("Nothing to undo.");
      return;
    }
    setGame(next);
    clearSelection();
    showInfo("Undid last move.");
  }

  // PUBLIC_INTERFACE
  function onHint() {
    /** Compute a simple hint: find any legal move from top-most movable cards. */
    const candidates = [];
    // Tableau tops and any face-up sequences are handled by engine's legal move query.
    for (const pile of game.tableau) {
      const topId = getTopCardId(pile);
      if (topId) candidates.push(topId);
    }
    // Waste top
    if (game.waste.length) candidates.push(game.waste[game.waste.length - 1]);

    for (const cardId of candidates) {
      const moves = getLegalMovesForCard(game, cardId);
      if (moves.length) {
        showInfo(moves[0].label);
        return;
      }
    }
    showInfo("No obvious moves. Try drawing or uncovering cards.");
  }

  function applyMoveAndPostProcess(nextGame, moveScoreDelta = 0) {
    const withReveal = revealIfNeeded(nextGame);
    const withScore = scoreAfterMove(withReveal, moveScoreDelta);
    setGame(withScore);
    clearSelection();

    // Gentle auto-move: if something is trivially movable to foundation, do it once.
    const auto = tryAutoMoveToFoundation(withScore);
    if (auto !== withScore) {
      setGame(auto);
      announce(live, "Auto-moved a card to the foundation.");
    }
  }

  // --- Board interactions ---------------------------------------------------

  // PUBLIC_INTERFACE
  function onTapStock() {
    /** Tap stock: draw one to waste; if empty, recycle waste to stock. */
    if (game.stock.length === 0) {
      if (game.waste.length === 0) return;
      const next = recycleWasteToStock(game);
      setGame(next);
      clearSelection();
      showInfo("Recycled waste to stock.");
      return;
    }
    const next = moveCardGroup(game, {
      from: { type: "stock" },
      to: { type: "waste" },
      cardIds: [game.stock[game.stock.length - 1]],
      label: "Draw",
    });
    applyMoveAndPostProcess(next, 5);
    showInfo("Drew a card.");
  }

  // PUBLIC_INTERFACE
  function onTapWasteTop() {
    /** Tap waste top: select it for moving, or attempt auto-foundation on double-tap. */
    const topId = game.waste[game.waste.length - 1];
    if (!topId) return;
    onTapCard(topId);
  }

  // PUBLIC_INTERFACE
  function onTapFoundation(index) {
    /** Tap foundation: if a card is selected, attempt to move it here. */
    if (!selectedCardId) return;
    const next = moveToFoundationIfLegal(game, selectedCardId, index);
    if (next === game) {
      showError("Can't move there.");
      return;
    }
    applyMoveAndPostProcess(next, 10);
    showInfo("Moved to foundation.");
  }

  // PUBLIC_INTERFACE
  function onTapTableau(index) {
    /**
     * Tap tableau pile surface: if card selected, attempt move.
     * If no selection, tap will select the top face-up card (or do nothing).
     */
    if (selectedCardId) {
      const next = moveCardGroup(game, {
        from: null,
        to: { type: "tableau", index },
        cardIds: [selectedCardId],
        label: "Move",
      });
      if (next === game) {
        showError("That move isn't legal.");
        return;
      }
      applyMoveAndPostProcess(next, 5);
      showInfo("Moved card.");
      return;
    }

    const pile = game.tableau[index];
    const topId = getTopCardId(pile);
    if (topId) {
      selectCard(topId);
      showInfo("Selected card.");
    }
  }

  // PUBLIC_INTERFACE
  function onTapCard(cardId) {
    /** Tap a card to select/unselect; double-tap attempts auto-foundation. */
    const now = Date.now();
    const last = lastTapRef.current;
    const isDoubleTap = last.cardId === cardId && now - last.t < 350;
    lastTapRef.current = { cardId, t: now };

    if (isDoubleTap) {
      const next = tryAutoMoveToFoundation(game, cardId);
      if (next !== game) {
        applyMoveAndPostProcess(next, 10);
        showInfo("Moved to foundation.");
        return;
      }
      showError("No foundation move available.");
      return;
    }

    if (selectedCardId === cardId) {
      clearSelection();
      return;
    }
    selectCard(cardId);
  }

  // PUBLIC_INTERFACE
  function onDropToTableau(cardId, tableauIndex) {
    /** Drop handler: attempt to move selected card to a tableau pile. */
    const moving = selectedCardId || cardId;
    if (!moving) return;

    const next = moveCardGroup(game, {
      from: null,
      to: { type: "tableau", index: tableauIndex },
      cardIds: [moving],
      label: "Move",
    });
    if (next === game) {
      showError("That move isn't legal.");
      return;
    }
    applyMoveAndPostProcess(next, 5);
    showInfo("Moved card.");
  }

  // PUBLIC_INTERFACE
  function onDropToFoundation(cardId, foundationIndex) {
    /** Drop handler: attempt to move selected card to a foundation stack. */
    const moving = selectedCardId || cardId;
    if (!moving) return;

    const next = moveToFoundationIfLegal(game, moving, foundationIndex);
    if (next === game) {
      showError("That move isn't legal.");
      return;
    }
    applyMoveAndPostProcess(next, 10);
    showInfo("Moved to foundation.");
  }

  // PUBLIC_INTERFACE
  function onExport() {
    /** Export current game JSON to clipboard for debugging/support. */
    const json = JSON.stringify(serializeGame(game), null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => showInfo("Game copied to clipboard."))
      .catch(() => showError("Couldn't access clipboard."));
  }

  // PUBLIC_INTERFACE
  function onImport() {
    /** Import game JSON from clipboard (best-effort). */
    navigator.clipboard
      .readText()
      .then((txt) => {
        const parsed = JSON.parse(txt);
        const next = unserializeGame(parsed);
        setGame(next);
        clearSelection();
        showInfo("Imported game.");
      })
      .catch(() => showError("Couldn't import. Copy a valid game JSON first."));
  }

  const selectedMoves = useMemo(() => {
    if (!selectedCardId) return [];
    return getLegalMovesForCard(game, selectedCardId);
  }, [game, selectedCardId]);

  // Board-level press to clear selection when tapping empty space.
  const boardPress = usePress({
    onPress: (e) => {
      // Avoid clearing when tapping on actionable elements.
      const target = e.target;
      if (target && target.closest && target.closest("[data-no-board-clear]")) return;
      clearSelection();
    },
  });

  return (
    <div className="App" {...boardPress.handlers}>
      <TopBar
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "ocean" ? "ocean-dark" : "ocean"))}
        onNewGame={onNewGame}
        onUndo={onUndo}
        onHint={onHint}
        onExport={onExport}
        onImport={onImport}
      />

      <main className="Board" aria-label="Solitaire board">
        <section className="Row TopRow" aria-label="Stock, waste, and foundations">
          <div className="StackGroup">
            <div className="StackLabel">Stock</div>
            <div className="Stack" data-no-board-clear>
              <div
                className="Slot"
                role="button"
                tabIndex={0}
                aria-label="Stock"
                onClick={onTapStock}
                onKeyDown={(e) => e.key === "Enter" && onTapStock()}
              >
                {game.stock.length ? (
                  <Card faceDown />
                ) : (
                  <div className="EmptyHint">↻</div>
                )}
              </div>
            </div>
          </div>

          <div className="StackGroup">
            <div className="StackLabel">Waste</div>
            <div className="Stack" data-no-board-clear>
              <div
                className="Slot"
                role="button"
                tabIndex={0}
                aria-label="Waste"
                onClick={onTapWasteTop}
                onKeyDown={(e) => e.key === "Enter" && onTapWasteTop()}
              >
                {game.waste.length ? (
                  <Card
                    card={game.cardsById[game.waste[game.waste.length - 1]]}
                    selected={selectedCardId === game.waste[game.waste.length - 1]}
                    onTap={() => onTapWasteTop()}
                  />
                ) : (
                  <div className="EmptyHint">—</div>
                )}
              </div>
            </div>
          </div>

          <div className="Foundations" aria-label="Foundations" data-no-board-clear>
            {game.foundations.map((f, i) => {
              const topId = f[f.length - 1];
              const topCard = topId ? game.cardsById[topId] : null;
              return (
                <div key={i} className="StackGroup">
                  <div className="StackLabel">Foundation</div>
                  <div className="Stack">
                    <div
                      className="Slot droppable"
                      role="button"
                      tabIndex={0}
                      aria-label={`Foundation ${i + 1}`}
                      onClick={() => onTapFoundation(i)}
                      onKeyDown={(e) => e.key === "Enter" && onTapFoundation(i)}
                      data-drop="foundation"
                      data-drop-index={i}
                    >
                      {topCard ? (
                        <Card card={topCard} />
                      ) : (
                        <div className="EmptyHint">A</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="Row TableauRow" aria-label="Tableau">
          {game.tableau.map((pile, i) => {
            return (
              <div key={i} className="TableauPile" aria-label={`Tableau pile ${i + 1}`} data-no-board-clear>
                <div
                  className="TableauSurface droppable"
                  role="button"
                  tabIndex={0}
                  onClick={() => onTapTableau(i)}
                  onKeyDown={(e) => e.key === "Enter" && onTapTableau(i)}
                  aria-label={`Tableau pile ${i + 1}`}
                  data-drop="tableau"
                  data-drop-index={i}
                >
                  {pile.length === 0 ? (
                    <div className="EmptyTableau">K</div>
                  ) : (
                    pile.map((cardId, idx) => {
                      const c = game.cardsById[cardId];
                      const isTop = idx === pile.length - 1;
                      return (
                        <div
                          key={cardId}
                          className="TableauCardWrapper"
                          style={{ top: idx * 18 }}
                        >
                          <Card
                            card={c}
                            faceDown={!c.faceUp}
                            selected={selectedCardId === cardId}
                            onTap={() => (c.faceUp ? onTapCard(cardId) : undefined)}
                            isTop={isTop}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <aside className="HintTray" aria-label="Selection hint">
          {selectedCardId ? (
            <>
              <div className="HintTitle">Moves</div>
              {selectedMoves.length ? (
                <ul className="HintList">
                  {selectedMoves.slice(0, 5).map((m) => (
                    <li key={m.id}>{m.label}</li>
                  ))}
                </ul>
              ) : (
                <div className="HintEmpty">No legal moves for this card.</div>
              )}
            </>
          ) : (
            <div className="HintEmpty">Tap a card to select. Double-tap to auto-move to foundation.</div>
          )}
        </aside>
      </main>

      <BottomBar
        stockCount={game.stock.length}
        wasteCount={game.waste.length}
        moves={game.stats.moves}
        score={game.stats.score}
        onNewGame={onNewGame}
        onUndo={onUndo}
        onHint={onHint}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="SrOnly" aria-live="polite" aria-atomic="true" ref={live.ref} />
    </div>
  );
}

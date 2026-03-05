/**
 * Classic Klondike Solitaire engine (draw-1).
 * State is intentionally plain JSON for easy persistence and debugging.
 */

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function isRedSuit(suit) {
  return suit === "♥" || suit === "♦";
}

function rankValue(rank) {
  const i = RANKS.indexOf(rank);
  return i + 1;
}

function canStackOnTableau(movingCard, targetCard) {
  // moving goes onto target
  if (!movingCard || !targetCard) return false;
  const movingRed = isRedSuit(movingCard.suit);
  const targetRed = isRedSuit(targetCard.suit);
  if (movingRed === targetRed) return false;
  return rankValue(movingCard.rank) === rankValue(targetCard.rank) - 1;
}

function canMoveToEmptyTableau(movingCard) {
  return movingCard && movingCard.rank === "K";
}

function canPlaceOnFoundation(movingCard, foundationTopCard) {
  if (!movingCard) return false;
  if (!foundationTopCard) return movingCard.rank === "A";
  if (movingCard.suit !== foundationTopCard.suit) return false;
  return rankValue(movingCard.rank) === rankValue(foundationTopCard.rank) + 1;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

function findCardLocation(game, cardId) {
  // Return {type, index?, pos?}
  if (game.waste.includes(cardId)) return { type: "waste" };
  if (game.stock.includes(cardId)) return { type: "stock" };
  for (let i = 0; i < game.foundations.length; i++) {
    if (game.foundations[i].includes(cardId)) return { type: "foundation", index: i };
  }
  for (let i = 0; i < game.tableau.length; i++) {
    const pos = game.tableau[i].indexOf(cardId);
    if (pos !== -1) return { type: "tableau", index: i, pos };
  }
  return null;
}

function getPile(game, loc) {
  if (!loc) return null;
  if (loc.type === "waste") return game.waste;
  if (loc.type === "stock") return game.stock;
  if (loc.type === "foundation") return game.foundations[loc.index];
  if (loc.type === "tableau") return game.tableau[loc.index];
  return null;
}

// PUBLIC_INTERFACE
export function createNewGame() {
  /** Create and deal a new Klondike game (draw-1). */
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: uid(),
        suit,
        rank,
        faceUp: false,
      });
    }
  }
  const deck = shuffle(cards);

  const tableau = Array.from({ length: 7 }, () => []);
  const cardsById = {};
  for (const c of deck) cardsById[c.id] = c;

  // Deal tableau: pile i gets i+1 cards, last one faceUp.
  let idx = 0;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      const card = deck[idx++];
      tableau[i].push(card.id);
      if (j === i) cardsById[card.id].faceUp = true;
    }
  }

  const stock = deck.slice(idx).map((c) => c.id);
  const game = {
    version: 1,
    cardsById,
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    stats: { moves: 0, score: 0 },
    history: [],
  };
  // Snapshot initial state (so first undo returns to initial if desired)
  game.history = [serializeGame(game)];
  return game;
}

// PUBLIC_INTERFACE
export function serializeGame(game) {
  /** Serialize game into a JSON-friendly object (no functions). */
  const g = cloneGame(game);
  return g;
}

// PUBLIC_INTERFACE
export function unserializeGame(obj) {
  /** Restore game from serialized object, with minimal validation/fallback. */
  if (!obj || typeof obj !== "object") return createNewGame();
  // Ensure required fields
  const required = ["cardsById", "stock", "waste", "foundations", "tableau", "stats", "history"];
  for (const k of required) if (!(k in obj)) return createNewGame();
  return obj;
}

// PUBLIC_INTERFACE
export function undo(game) {
  /** Undo last move (single-step). */
  const hist = game.history || [];
  if (hist.length <= 1) return game;
  const nextHist = hist.slice(0, -1);
  const prev = nextHist[nextHist.length - 1];
  const restored = unserializeGame(prev);
  restored.history = nextHist;
  return restored;
}

function pushHistory(game) {
  const snap = serializeGame(game);
  const nextHist = [...(game.history || []), snap];
  // keep last N snapshots
  const MAX = 80;
  const trimmed = nextHist.length > MAX ? nextHist.slice(nextHist.length - MAX) : nextHist;
  game.history = trimmed;
}

// PUBLIC_INTERFACE
export function getTopCardId(pile) {
  /** Return top card id of a pile array, or null if empty. */
  return pile && pile.length ? pile[pile.length - 1] : null;
}

// PUBLIC_INTERFACE
export function recycleWasteToStock(game) {
  /** Move all waste back to stock (face down). */
  const next = cloneGame(game);
  if (next.waste.length === 0) return game;
  const waste = next.waste.slice().reverse(); // last waste becomes top of stock
  next.waste = [];
  // Flip all to face down
  for (const id of waste) next.cardsById[id].faceUp = false;
  next.stock = [...next.stock, ...waste];
  next.stats.moves += 1;
  pushHistory(next);
  return next;
}

// PUBLIC_INTERFACE
export function revealIfNeeded(game) {
  /** Ensure top of each tableau pile is face up (if any card exists). */
  const next = cloneGame(game);
  let changed = false;
  for (const pile of next.tableau) {
    const top = getTopCardId(pile);
    if (top && !next.cardsById[top].faceUp) {
      next.cardsById[top].faceUp = true;
      changed = true;
    }
  }
  return changed ? next : game;
}

// PUBLIC_INTERFACE
export function scoreAfterMove(game, delta) {
  /** Apply scoring delta (clamped) and return updated game. */
  if (!delta) return game;
  const next = cloneGame(game);
  next.stats.score = Math.max(0, (next.stats.score || 0) + delta);
  return next;
}

function removeCardIdsFromPile(pile, cardIds) {
  const set = new Set(cardIds);
  return pile.filter((id) => !set.has(id));
}

// PUBLIC_INTERFACE
export function moveCardGroup(game, move) {
  /**
   * Attempt a move. This is a general-purpose move used by UI:
   * - from can be null: engine will locate cardId by scanning.
   * - to can be {type:'waste'|'tableau'|'foundation', index?}
   * - cardIds should be an array, but UI uses single-card moves.
   *
   * Returns unchanged game if illegal.
   */
  const cardId = move.cardIds && move.cardIds[0];
  if (!cardId) return game;

  const fromLoc = move.from || findCardLocation(game, cardId);
  if (!fromLoc) return game;

  // cannot move from stock directly (stock top only via draw)
  if (fromLoc.type === "stock") return game;

  const fromPile = getPile(game, fromLoc);
  const card = game.cardsById[cardId];
  if (!card) return game;

  // In tableau, allow moving sequences only if selecting a card within pile and all below are faceUp.
  let movingIds = [cardId];
  if (fromLoc.type === "tableau") {
    const pile = fromPile;
    const pos = pile.indexOf(cardId);
    if (pos === -1) return game;
    const seq = pile.slice(pos);
    if (seq.some((id) => !game.cardsById[id].faceUp)) return game;
    movingIds = seq;
  } else {
    // waste/foundation: only top card can move
    if (fromPile[fromPile.length - 1] !== cardId) return game;
  }

  const to = move.to;
  if (!to) return game;

  // Validate by destination
  if (to.type === "waste") return game; // only stock draws to waste

  const next = cloneGame(game);

  const nextFromLoc = findCardLocation(next, cardId);
  const nextFromPile = getPile(next, nextFromLoc);

  // remove moving ids
  const newFromPile = removeCardIdsFromPile(nextFromPile, movingIds);

  // Ensure we only removed a suffix for tableau
  if (nextFromLoc.type === "tableau") {
    const pos = nextFromPile.indexOf(cardId);
    const expectedSuffix = nextFromPile.slice(pos);
    if (expectedSuffix.join(",") !== movingIds.join(",")) return game;
    next.tableau[nextFromLoc.index] = newFromPile;
  } else if (nextFromLoc.type === "waste") {
    next.waste = newFromPile;
  } else if (nextFromLoc.type === "foundation") {
    next.foundations[nextFromLoc.index] = newFromPile;
  }

  if (to.type === "tableau") {
    const destPile = next.tableau[to.index];
    const destTopId = getTopCardId(destPile);
    const destTopCard = destTopId ? next.cardsById[destTopId] : null;

    // destination rules
    const movingTopCard = next.cardsById[movingIds[0]];
    if (!destTopCard) {
      if (!canMoveToEmptyTableau(movingTopCard)) return game;
    } else {
      if (!canStackOnTableau(movingTopCard, destTopCard)) return game;
    }

    next.tableau[to.index] = [...destPile, ...movingIds];
    // moves + history
    next.stats.moves += 1;
    pushHistory(next);
    return next;
  }

  if (to.type === "foundation") {
    // Only single-card moves to foundation in classic Klondike
    if (movingIds.length !== 1) return game;
    const dest = next.foundations[to.index];
    const destTopId = getTopCardId(dest);
    const destTopCard = destTopId ? next.cardsById[destTopId] : null;
    if (!canPlaceOnFoundation(next.cardsById[cardId], destTopCard)) return game;

    next.foundations[to.index] = [...dest, cardId];
    next.stats.moves += 1;
    pushHistory(next);
    return next;
  }

  return game;
}

// PUBLIC_INTERFACE
export function moveToFoundationIfLegal(game, cardId, foundationIndex) {
  /** Convenience wrapper for moving a card to a foundation if legal. */
  return moveCardGroup(game, {
    from: null,
    to: { type: "foundation", index: foundationIndex },
    cardIds: [cardId],
    label: "Foundation",
  });
}

// PUBLIC_INTERFACE
export function isGameWon(game) {
  /** Won when all foundations have 13 cards. */
  return game.foundations.every((f) => f.length === 13);
}

// PUBLIC_INTERFACE
export function getLegalMovesForCard(game, cardId) {
  /**
   * Return a list of human-friendly possible moves for the given card id.
   * This is intentionally limited for hinting/UI.
   */
  const loc = findCardLocation(game, cardId);
  if (!loc) return [];
  const card = game.cardsById[cardId];
  if (!card || !card.faceUp) return [];

  // Only consider top card for non-tableau; for tableau allow moving sequences
  if (loc.type !== "tableau") {
    const pile = getPile(game, loc);
    if (getTopCardId(pile) !== cardId) return [];
  } else {
    const pile = getPile(game, loc);
    const pos = pile.indexOf(cardId);
    const seq = pile.slice(pos);
    if (seq.some((id) => !game.cardsById[id].faceUp)) return [];
  }

  const moves = [];

  // To foundations
  for (let i = 0; i < game.foundations.length; i++) {
    const dest = game.foundations[i];
    const topId = getTopCardId(dest);
    const topCard = topId ? game.cardsById[topId] : null;
    if (canPlaceOnFoundation(card, topCard)) {
      moves.push({
        id: `f-${i}`,
        label: `Move ${card.rank}${card.suit} to foundation`,
      });
    }
  }

  // To tableau
  for (let i = 0; i < game.tableau.length; i++) {
    const dest = game.tableau[i];
    const topId = getTopCardId(dest);
    const topCard = topId ? game.cardsById[topId] : null;
    if (!topCard) {
      if (canMoveToEmptyTableau(card)) {
        moves.push({ id: `t-${i}`, label: `Move ${card.rank}${card.suit} to empty tableau` });
      }
    } else if (topCard.faceUp && canStackOnTableau(card, topCard)) {
      moves.push({ id: `t-${i}`, label: `Move ${card.rank}${card.suit} onto ${topCard.rank}${topCard.suit}` });
    }
  }

  return moves;
}

// PUBLIC_INTERFACE
export function tryAutoMoveToFoundation(game, preferredCardId = null) {
  /**
   * Attempt to move a card to foundation (single step):
   * - If preferredCardId provided, try only that card.
   * - Else try waste top and tableau tops.
   */
  const tryCard = (cardId) => {
    if (!cardId) return null;
    const loc = findCardLocation(game, cardId);
    if (!loc) return null;

    // Only allow top card for tableau/waste
    if (loc.type === "waste") {
      if (game.waste[game.waste.length - 1] !== cardId) return null;
    }
    if (loc.type === "tableau") {
      const pile = game.tableau[loc.index];
      if (pile[pile.length - 1] !== cardId) return null;
    }
    if (loc.type === "foundation" || loc.type === "stock") return null;

    for (let i = 0; i < 4; i++) {
      const next = moveToFoundationIfLegal(game, cardId, i);
      if (next !== game) return next;
    }
    return null;
  };

  if (preferredCardId) {
    return tryCard(preferredCardId) || game;
  }

  const wasteTop = game.waste[game.waste.length - 1];
  const fromWaste = tryCard(wasteTop);
  if (fromWaste) return fromWaste;

  for (const pile of game.tableau) {
    const topId = pile[pile.length - 1];
    const res = tryCard(topId);
    if (res) return res;
  }
  return game;
}

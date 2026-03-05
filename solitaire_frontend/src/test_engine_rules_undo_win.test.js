import {
  createNewGame,
  isGameWon,
  moveCardGroup,
  moveToFoundationIfLegal,
  undo,
} from "./game/engine";

/**
 * Note: These tests intentionally avoid depending on the random initial deal
 * by constructing minimal valid game objects that match the engine's expected
 * state shape.
 */

function makeBaseGame({ cardsById, stock = [], waste = [], foundations, tableau, stats, history } = {}) {
  return {
    version: 1,
    cardsById: cardsById || {},
    stock,
    waste,
    foundations: foundations || [[], [], [], []],
    tableau: tableau || [[], [], [], [], [], [], []],
    stats: stats || { moves: 0, score: 0 },
    history: history || [],
  };
}

describe("engine move validation", () => {
  test("rejects moving from stock directly (stock -> tableau is illegal)", () => {
    const game = createNewGame();
    const topStock = game.stock[game.stock.length - 1];

    const next = moveCardGroup(game, {
      from: { type: "stock" },
      to: { type: "tableau", index: 0 },
      cardIds: [topStock],
      label: "Illegal",
    });

    expect(next).toBe(game);
  });

  test("allows stacking onto tableau only with alternating color and descending rank", () => {
    // Moving 6♣ onto 7♥ is legal (black onto red, 6 onto 7).
    const c6c = { id: "6C", rank: "6", suit: "♣", faceUp: true };
    const c7h = { id: "7H", rank: "7", suit: "♥", faceUp: true };

    const game = makeBaseGame({
      cardsById: { [c6c.id]: c6c, [c7h.id]: c7h },
      tableau: [
        [c6c.id], // from pile
        [c7h.id], // to pile
        [],
        [],
        [],
        [],
        [],
      ],
      history: [makeBaseGame()], // minimal "initial snapshot" placeholder
    });

    const next = moveCardGroup(game, {
      from: { type: "tableau", index: 0 },
      to: { type: "tableau", index: 1 },
      cardIds: [c6c.id],
      label: "Move",
    });

    expect(next).not.toBe(game);
    expect(next.tableau[0]).toEqual([]);
    expect(next.tableau[1]).toEqual([c7h.id, c6c.id]);
    expect(next.stats.moves).toBe(1);
    expect(next.history.length).toBe(game.history.length + 1);
  });

  test("rejects tableau stacking when colors do not alternate", () => {
    // Moving 6♦ onto 7♥ is illegal (red onto red).
    const c6d = { id: "6D", rank: "6", suit: "♦", faceUp: true };
    const c7h = { id: "7H", rank: "7", suit: "♥", faceUp: true };

    const game = makeBaseGame({
      cardsById: { [c6d.id]: c6d, [c7h.id]: c7h },
      tableau: [
        [c6d.id], // from pile
        [c7h.id], // to pile
        [],
        [],
        [],
        [],
        [],
      ],
      history: [makeBaseGame()],
    });

    const next = moveCardGroup(game, {
      from: { type: "tableau", index: 0 },
      to: { type: "tableau", index: 1 },
      cardIds: [c6d.id],
      label: "Move",
    });

    expect(next).toBe(game);
  });

  test("rejects moving to empty tableau unless the moving card is a King", () => {
    const cQ = { id: "QH", rank: "Q", suit: "♥", faceUp: true };
    const game = makeBaseGame({
      cardsById: { [cQ.id]: cQ },
      tableau: [[cQ.id], [], [], [], [], [], []],
      history: [makeBaseGame()],
    });

    const next = moveCardGroup(game, {
      from: { type: "tableau", index: 0 },
      to: { type: "tableau", index: 1 },
      cardIds: [cQ.id],
      label: "Move",
    });

    expect(next).toBe(game);
  });

  test("allows moving an Ace to an empty foundation, rejects wrong suit sequencing", () => {
    const aSpades = { id: "AS", rank: "A", suit: "♠", faceUp: true };
    const twoHearts = { id: "2H", rank: "2", suit: "♥", faceUp: true };

    const game = makeBaseGame({
      cardsById: { [aSpades.id]: aSpades, [twoHearts.id]: twoHearts },
      waste: [aSpades.id],
      foundations: [[], [], [], []],
      history: [makeBaseGame()],
    });

    const afterAce = moveToFoundationIfLegal(game, aSpades.id, 0);
    expect(afterAce).not.toBe(game);
    expect(afterAce.waste).toEqual([]);
    expect(afterAce.foundations[0]).toEqual([aSpades.id]);

    // Now try to place 2♥ on top of A♠ in same foundation: illegal due to suit mismatch
    const game2 = makeBaseGame({
      cardsById: { [aSpades.id]: aSpades, [twoHearts.id]: twoHearts },
      waste: [twoHearts.id],
      foundations: [[aSpades.id], [], [], []],
      history: [makeBaseGame()],
    });

    const next2 = moveToFoundationIfLegal(game2, twoHearts.id, 0);
    expect(next2).toBe(game2);
  });
});

describe("engine undo behavior", () => {
  test("undo returns the same game when there is nothing to undo (history length <= 1)", () => {
    const game = createNewGame();
    expect(game.history.length).toBe(1);

    const next = undo(game);
    expect(next).toBe(game);
  });

  test("undo restores the previous snapshot and trims history by one", () => {
    const c6c = { id: "6C", rank: "6", suit: "♣", faceUp: true };
    const c7h = { id: "7H", rank: "7", suit: "♥", faceUp: true };

    // Build an initial snapshot with 6♣ in pile 0 and 7♥ in pile 1.
    const initial = makeBaseGame({
      cardsById: { [c6c.id]: c6c, [c7h.id]: c7h },
      tableau: [[c6c.id], [c7h.id], [], [], [], [], []],
      stats: { moves: 0, score: 0 },
      history: [],
    });
    // Per engine convention, history contains serialized snapshots.
    initial.history = [initial];

    const moved = moveCardGroup(initial, {
      from: { type: "tableau", index: 0 },
      to: { type: "tableau", index: 1 },
      cardIds: [c6c.id],
      label: "Move",
    });

    expect(moved).not.toBe(initial);
    expect(moved.history.length).toBe(2);
    expect(moved.tableau[1]).toEqual([c7h.id, c6c.id]);
    expect(moved.stats.moves).toBe(1);

    const undone = undo(moved);
    expect(undone).not.toBe(moved);
    expect(undone.history.length).toBe(1);

    // Back to initial board arrangement and stats.
    expect(undone.tableau[0]).toEqual([c6c.id]);
    expect(undone.tableau[1]).toEqual([c7h.id]);
    expect(undone.stats.moves).toBe(0);
  });
});

describe("engine win detection", () => {
  test("isGameWon is false when any foundation has less than 13 cards", () => {
    const game = makeBaseGame({
      foundations: [
        Array.from({ length: 13 }, (_, i) => `S${i}`),
        Array.from({ length: 13 }, (_, i) => `H${i}`),
        Array.from({ length: 12 }, (_, i) => `D${i}`), // not full
        Array.from({ length: 13 }, (_, i) => `C${i}`),
      ],
    });

    expect(isGameWon(game)).toBe(false);
  });

  test("isGameWon is true when all four foundations have 13 cards", () => {
    const game = makeBaseGame({
      foundations: [
        Array.from({ length: 13 }, (_, i) => `S${i}`),
        Array.from({ length: 13 }, (_, i) => `H${i}`),
        Array.from({ length: 13 }, (_, i) => `D${i}`),
        Array.from({ length: 13 }, (_, i) => `C${i}`),
      ],
    });

    expect(isGameWon(game)).toBe(true);
  });
});

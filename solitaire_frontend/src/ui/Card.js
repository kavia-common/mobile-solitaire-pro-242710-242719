import React from "react";
import { usePress } from "../hooks/usePress";

function suitClass(suit) {
  return suit === "♥" || suit === "♦" ? "SuitRed" : "SuitBlack";
}

// PUBLIC_INTERFACE
export function Card({ card, faceDown = false, selected = false, onTap }) {
  /** Render a playing card; faceDown renders card back. */
  const press = usePress({ onPress: onTap });

  if (faceDown) {
    return <div className={`Card CardFaceDown ${selected ? "CardSelected" : ""}`} aria-label="Face-down card" />;
  }

  if (!card) return null;

  return (
    <div
      className={`Card ${selected ? "CardSelected" : ""}`}
      role={onTap ? "button" : "img"}
      tabIndex={onTap ? 0 : -1}
      aria-label={`${card.rank} of ${card.suit}`}
      onKeyDown={(e) => {
        if (!onTap) return;
        if (e.key === "Enter") onTap();
      }}
      {...(onTap ? press.handlers : {})}
    >
      <div className={`CardCorner ${suitClass(card.suit)}`}>
        {card.rank}
        {card.suit}
      </div>
      <div className={`CardCenter ${suitClass(card.suit)}`}>{card.suit}</div>
      <div className={`CardCorner CardCornerBottom ${suitClass(card.suit)}`}>
        {card.rank}
        {card.suit}
      </div>
    </div>
  );
}

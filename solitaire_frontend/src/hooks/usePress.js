import { useCallback, useRef } from "react";

/**
 * Minimal "press" abstraction for touch-first interactions without extra deps.
 * Uses pointer events when available.
 */

// PUBLIC_INTERFACE
export function usePress({ onPress }) {
  /** Return handlers to attach to an element for consistent press behavior. */
  const lastRef = useRef(0);

  const handle = useCallback(
    (e) => {
      const now = Date.now();
      if (now - lastRef.current < 40) return;
      lastRef.current = now;
      onPress?.(e);
    },
    [onPress]
  );

  return {
    handlers: {
      onPointerDown: (e) => {
        // Avoid selecting text while tapping.
        if (e.pointerType === "touch") e.preventDefault();
      },
      onClick: handle,
    },
  };
}

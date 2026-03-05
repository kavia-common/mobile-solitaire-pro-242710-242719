import { useMemo, useRef } from "react";

// PUBLIC_INTERFACE
export function useLiveRegion() {
  /** Provides a ref to an aria-live element to announce short messages. */
  const ref = useRef(null);
  return useMemo(() => ({ ref }), []);
}

// PUBLIC_INTERFACE
export function announce(liveRegion, message) {
  /** Announce a message via aria-live region. */
  try {
    if (!liveRegion?.ref?.current) return;
    liveRegion.ref.current.textContent = "";
    // Force DOM mutation so screen readers re-announce.
    window.setTimeout(() => {
      if (liveRegion.ref.current) liveRegion.ref.current.textContent = message;
    }, 10);
  } catch {
    // ignore
  }
}

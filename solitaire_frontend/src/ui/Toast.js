import React, { useEffect } from "react";

// PUBLIC_INTERFACE
export function Toast({ toast, onDismiss }) {
  /** Transient message popup. Auto-dismisses after a short time. */
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => onDismiss?.(), 2600);
    return () => window.clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const cls =
    toast.tone === "success"
      ? "Toast ToastSuccess"
      : toast.tone === "error"
        ? "Toast ToastError"
        : "Toast ToastInfo";

  return (
    <div className={cls} role="status" aria-live="polite" aria-atomic="true" data-no-board-clear>
      <div className="ToastMsg">{toast.message}</div>
      <button className="Btn BtnIcon" onClick={onDismiss} aria-label="Dismiss message">
        ✕
      </button>
    </div>
  );
}

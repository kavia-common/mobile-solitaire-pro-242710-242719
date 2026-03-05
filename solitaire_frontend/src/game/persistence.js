const KEY = "mobile-solitaire-pro::state:v1";

// PUBLIC_INTERFACE
export function loadState() {
  /** Load persisted app state from localStorage (best-effort). */
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// PUBLIC_INTERFACE
export function saveState(state) {
  /** Save app state to localStorage (best-effort). */
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota/private mode
  }
}

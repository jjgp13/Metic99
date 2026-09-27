import { STORAGE, type InputMode } from "./constants";

// Kept in memory too, so a switch still applies when storage is blocked.
let mode: InputMode | null = null;

/** How the player enters answers on screen: keypad (default) or drawing pad. */
export function inputMode(): InputMode {
  if (mode === null) {
    try {
      mode = localStorage.getItem(STORAGE.INPUT_MODE) === "draw" ? "draw" : "keys";
    } catch {
      mode = "keys"; // Storage blocked (e.g. private mode).
    }
  }
  return mode;
}

export function setInputMode(next: InputMode): void {
  mode = next;
  try {
    localStorage.setItem(STORAGE.INPUT_MODE, next);
  } catch {
    // Not persisted across visits; the in-memory choice still applies.
  }
}

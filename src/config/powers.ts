import { POWER_KINDS, STORAGE, type PowerKind } from "./constants";

// Kept in memory too, so a pick still applies when storage is blocked.
let picked: string | null = null;

/** The power the player picked on the menu (falls back to the first one). */
export function selectedPower(): PowerKind {
  if (picked === null) {
    try {
      picked = localStorage.getItem(STORAGE.POWER);
    } catch {
      // Storage blocked (e.g. private mode): use the default power.
    }
  }
  return POWER_KINDS.find((k) => k === picked) ?? POWER_KINDS[0];
}

export function selectPower(kind: PowerKind): void {
  picked = kind;
  try {
    localStorage.setItem(STORAGE.POWER, kind);
  } catch {
    // Not persisted across visits; the in-memory pick still applies.
  }
}

import { RENDER3D, STORAGE } from "./constants";

export type ShipChoice = (typeof RENDER3D.SHIPS)[number];

// Kept in memory too, so a pick still applies when storage is blocked.
let picked: string | null = null;

/** The ship the player picked on the menu (falls back to the first one). */
export function selectedShip(): ShipChoice {
  if (picked === null) {
    try {
      picked = localStorage.getItem(STORAGE.SHIP);
    } catch {
      // Storage blocked (e.g. private mode): use the default ship.
    }
  }
  return RENDER3D.SHIPS.find((s) => s.model === picked) ?? RENDER3D.SHIPS[0];
}

export function selectShip(ship: ShipChoice): void {
  picked = ship.model;
  try {
    localStorage.setItem(STORAGE.SHIP, ship.model);
  } catch {
    // Not persisted across visits; the in-memory pick still applies.
  }
}

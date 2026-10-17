import { STORAGE } from "../config/constants";
import { selectedPower } from "../config/powers";
import { NetClient } from "./NetClient";
import { cleanName } from "./protocol";

/**
 * The browser's one online connection, shared by the lobby and the game
 * screen (a scene change must not drop it), plus the player's online name.
 *
 * The server address is this page's host (the game server serves the page)
 * unless VITE_NET_URL points elsewhere, e.g. a GitHub Pages build talking to
 * a server hosted somewhere else. `?lag=150&jitter=50` fakes a slow network
 * from this browser (S5's break-it experiment).
 */
let client: NetClient | null = null;

export function onlineClient(): NetClient {
  if (!client || client.state === "closed") {
    const params = new URLSearchParams(window.location.search);
    client = new NetClient(
      NetClient.defaultUrl(window.location, import.meta.env.VITE_NET_URL),
      { name: onlineName(), power: selectedPower(), build: __BUILD_ID__ },
      { ms: Number(params.get("lag") ?? 0) || 0, jitterMs: Number(params.get("jitter") ?? 0) || 0 },
    );
  }
  return client;
}

/** Close the connection (back to the menu, or to reconnect with a new name). */
export function leaveOnline(): void {
  client?.close();
  client = null;
}

/** A random name picked once per visit when none is saved. */
let visitName: string | null = null;

export function onlineName(): string {
  let saved = "";
  try {
    saved = localStorage.getItem(STORAGE.NET_NAME) ?? "";
  } catch {
    // Storage blocked (private mode): a random name for this visit.
  }
  // Not a game rule: a name may use Math.random.
  visitName ??= `PILOT${Math.floor(Math.random() * 90 + 10)}`;
  return cleanName(saved) || visitName;
}

export function setOnlineName(name: string): void {
  visitName = cleanName(name) || visitName;
  try {
    localStorage.setItem(STORAGE.NET_NAME, cleanName(name));
  } catch {
    // Not saved; it still applies to this visit's next connection.
  }
}

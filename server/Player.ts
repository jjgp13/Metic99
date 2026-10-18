import type { WebSocket } from "ws";
import type { PowerKind } from "../src/config/constants";
import { encode, type ServerMessage } from "../src/net/protocol";
import type { Lag } from "../src/net/Lag";

/**
 * One connected person (docs/NETCODE.md, S2): their socket and what they
 * told us in their hello. A player outlives matches: they wait in the lobby,
 * play, and come back to the lobby.
 *
 * Connection lifecycle: connect → hello (checked: protocol and rules id must
 * match ours) → lobby → match → lobby … → close. Pings keep the round-trip
 * time known; a socket that stops answering is closed by the heartbeat in
 * main.ts.
 */
export class Player {
  name = "";
  power: PowerKind = "freeze";
  /** Said hello with a matching protocol and rules id. */
  ready = false;
  /** Answered the last heartbeat ping (ws-level, see main.ts). */
  alive = true;

  constructor(
    readonly id: number,
    private readonly socket: WebSocket,
    private readonly lag: Lag,
  ) {}

  send(message: ServerMessage): void {
    this.sendText(encode(message));
  }

  /** An already-encoded message: a broadcast encodes once for everyone. */
  sendText(text: string): void {
    this.lag.later(() => {
      if (this.socket.readyState === this.socket.OPEN) this.socket.send(text);
    });
  }

  close(): void {
    this.socket.close();
  }
}

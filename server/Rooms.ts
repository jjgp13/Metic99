import { NET } from "../src/config/constants";
import type { Player } from "./Player";
import { Room } from "./Room";

/**
 * Every room on this server, and the rule for where a new player goes
 * (docs/NETCODE.md, launch). This is the capacity limit of the experiment:
 * a free server has a small, fixed CPU, so instead of growing it says
 * "busy" past `maxRooms`. Each running room costs roughly one 60 Hz match
 * of 8 fields; measure with the tick stats in the log before raising it.
 *
 * Where a new player goes, in order:
 * 1. a room in its lobby with a free seat (they play in the next match);
 * 2. a new room, if there are fewer than `maxRooms`;
 * 3. the queue of a running room (they play in its next match);
 * 4. nowhere: the server is full (the caller says "busy, try later").
 * Empty rooms that aren't running are closed.
 */
export class Rooms {
  private readonly rooms: Room[] = [];
  private nextId = 1;

  constructor(readonly maxRooms: number) {}

  place(player: Player): Room | null {
    const room =
      this.rooms.find((r) => !r.running && r.waiting < NET.SEATS) ??
      (this.rooms.length < this.maxRooms ? this.open() : null) ??
      this.rooms.filter((r) => r.waiting < NET.SEATS).sort((a, b) => a.waiting - b.waiting)[0] ??
      null;
    room?.join(player);
    return room;
  }

  /** Run every room's due steps; a room that throws is closed, not the server. */
  tick(): void {
    for (const room of [...this.rooms]) {
      try {
        room.tick();
      } catch (error) {
        console.error(`[room ${room.id}] crashed, closing it:`, error);
        room.closeAll("the server had a problem with your match");
        this.remove(room);
        continue;
      }
      if (room.isEmpty && !room.running) this.remove(room);
    }
  }

  announce(): void {
    for (const room of this.rooms) room.announce();
  }

  /** "2 rooms, 11 players": for the log and /health. */
  summary(): string {
    const players = this.rooms.reduce((n, r) => n + r.size, 0);
    return `${this.rooms.length}/${this.maxRooms} rooms, ${players} players`;
  }

  private open(): Room {
    const room = new Room(this.nextId++);
    this.rooms.push(room);
    console.log(`[rooms] opened room ${room.id} (${this.summary()})`);
    return room;
  }

  private remove(room: Room): void {
    this.rooms.splice(this.rooms.indexOf(room), 1);
    console.log(`[rooms] closed room ${room.id} (${this.summary()})`);
  }
}

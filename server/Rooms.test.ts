import { describe, expect, it } from "vitest";
import { NET } from "../src/config/constants";
import type { Player } from "./Player";
import { Rooms } from "./Rooms";

/** A player without a socket (what Room needs of one). */
function fakePlayer(id: number): Player {
  return { id, name: `P${id}`, power: "freeze", ready: true, alive: true, send() {}, close() {} } as unknown as Player;
}

describe("Rooms (capacity)", () => {
  it("fills a lobby to 8 seats, then opens another room", () => {
    const rooms = new Rooms(3);
    const placed = Array.from({ length: NET.SEATS + 1 }, (_, i) => rooms.place(fakePlayer(i)));
    expect(new Set(placed.slice(0, NET.SEATS).map((r) => r!.id))).toEqual(new Set([1]));
    expect(placed[NET.SEATS]!.id).toBe(2);
    expect(rooms.summary()).toBe("2/3 rooms, 9 players");
  });

  it("says busy (null) when every room is full and the cap is reached", () => {
    const rooms = new Rooms(1);
    for (let i = 0; i < NET.SEATS; i++) expect(rooms.place(fakePlayer(i))).not.toBeNull();
    expect(rooms.place(fakePlayer(99))).toBeNull();
  });

  it("closes a room once everyone left (and it isn't running)", () => {
    const rooms = new Rooms(3);
    const player = fakePlayer(1);
    const room = rooms.place(player)!;
    room.leave(player);
    rooms.tick();
    expect(rooms.summary()).toBe("0/3 rooms, 0 players");
  });
});

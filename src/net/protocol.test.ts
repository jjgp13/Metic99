import { describe, expect, it } from "vitest";
import { cleanName, parseClient, parseInput } from "./protocol";

/** The server never trusts a client: anything off is refused (null). */
describe("parseClient", () => {
  const msg = (x: unknown) => parseClient(JSON.stringify(x));

  it("accepts a well-formed hello and cleans the name", () => {
    expect(msg({ t: "hello", protocol: 1, build: "abc", name: "ana-<b>!", power: "slow" })).toEqual({
      t: "hello",
      protocol: 1,
      build: "abc",
      name: "ANAB",
      power: "slow",
    });
  });

  it("refuses an unknown power, a bad step, junk and unknown types", () => {
    expect(msg({ t: "hello", protocol: 1, build: "abc", name: "x", power: "nuke" })).toBeNull();
    expect(msg({ t: "inputs", upTo: -1, entries: [] })).toBeNull();
    expect(msg({ t: "inputs", upTo: 1.5, entries: [] })).toBeNull();
    expect(msg({ t: "admin" })).toBeNull();
    expect(parseClient("{not json")).toBeNull();
  });

  it("rebuilds inputs, dropping extra properties", () => {
    const parsed = msg({ t: "inputs", upTo: 10, entries: [{ step: 3, input: { type: "power", score: 1e9 } }] });
    expect(parsed).toEqual({ t: "inputs", upTo: 10, entries: [{ step: 3, input: { type: "power" } }] });
  });

  it("refuses a batch with one bad entry, and huge batches", () => {
    expect(msg({ t: "inputs", upTo: 10, entries: [{ step: 3, input: { type: "digits", digits: "123" } }] })).toBeNull();
    const many = Array.from({ length: 65 }, () => ({ step: 1, input: { type: "clear" } }));
    expect(msg({ t: "inputs", upTo: 10, entries: many })).toBeNull();
  });

  it("accepts message reports and fingerprints of the right shape", () => {
    expect(msg({ t: "inputs", upTo: 5, entries: [{ step: 5, seq: 0 }] })).toEqual({
      t: "inputs",
      upTo: 5,
      entries: [{ step: 5, seq: 0 }],
    });
    expect(msg({ t: "check", step: 60, hash: "0badf00d" })).toEqual({ t: "check", step: 60, hash: "0badf00d" });
    expect(msg({ t: "check", step: 60, hash: "nothex!!" })).toBeNull();
  });
});

describe("parseInput", () => {
  it("only lets through inputs a player can make", () => {
    expect(parseInput({ type: "digits", digits: "12" })).toEqual({ type: "digits", digits: "12" });
    expect(parseInput({ type: "send", cost: 50 })).toEqual({ type: "send", cost: 50 });
    expect(parseInput({ type: "send", cost: 37 })).toBeNull();
    expect(parseInput({ type: "target", aim: "kos" })).toEqual({ type: "target", aim: "kos" });
    expect(parseInput({ type: "target", aim: { seat: 3 } })).toEqual({ type: "target", aim: { seat: 3 } });
    expect(parseInput({ type: "target", aim: { seat: 99 } })).toBeNull();
    // Messages from the match are never accepted as inputs.
    expect(parseInput({ type: "attack", from: 1, cost: 100, aliens: [] })).toBeNull();
  });
});

describe("cleanName", () => {
  it("keeps letters and digits, drops accents, upper case, at most 8", () => {
    expect(cleanName("José García 99")).toBe("JOSEGARC");
  });
});

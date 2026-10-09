import { describe, expect, it } from "vitest";
import { FNV_OFFSET, hashByte, hashNumber, hashString } from "./hash";

describe("hashByte / hashString", () => {
  it("is standard FNV-1a: the byte 'a' (0x61) hashes to the published value", () => {
    expect(hashByte(FNV_OFFSET, 0x61)).toBe(0xe40c292c);
  });

  it("stays an unsigned 32-bit integer", () => {
    let h = FNV_OFFSET;
    for (let i = 0; i < 1000; i++) h = hashByte(h, i & 0xff);
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true);
  });

  it("gives different strings different hashes, and order matters", () => {
    expect(hashString(FNV_OFFSET, "ab")).not.toBe(hashString(FNV_OFFSET, "ba"));
    expect(hashString(FNV_OFFSET, "x")).not.toBe(hashString(FNV_OFFSET, "y"));
  });
});

/**
 * The expected numbers come from the rule in hashNumber's comment: the 8
 * bytes of the 64-bit float, little-endian, each folded in with hashByte.
 */
describe("hashNumber", () => {
  it("matches the reference values (the exact 8 bytes, little-endian)", () => {
    expect(hashNumber(FNV_OFFSET, 0)).toBe(0x9be17165);
    expect(hashNumber(FNV_OFFSET, 1)).toBe(0x8c6a9878);
    expect(hashNumber(FNV_OFFSET, 85.5)).toBe(0xd4cfa1e8);
  });

  it("tells numbers apart that differ only in the last bit", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(hashNumber(FNV_OFFSET, 0.1 + 0.2)).toBe(0x075ad7f6);
    expect(hashNumber(FNV_OFFSET, 0.3)).toBe(0xc5cc6029);
  });

  it("tells 0 and -0 apart (same printed text, different bits)", () => {
    // String(-0) is "0", so hashing the text couldn't see this.
    expect(hashNumber(FNV_OFFSET, -0)).toBe(0x1be23ae5);
    expect(hashNumber(FNV_OFFSET, -0)).not.toBe(hashNumber(FNV_OFFSET, 0));
  });

  it("chains: hashing 1 then 2 continues from the hash so far", () => {
    expect(hashNumber(hashNumber(FNV_OFFSET, 1), 2)).toBe(0x45ca9438);
  });
});

/**
 * A small, fast hash (32-bit FNV-1a) for state fingerprints (fingerprint.ts).
 *
 * FNV-1a eats one byte at a time: mix the byte in with XOR, then multiply by
 * a prime so it spreads over all 32 bits. Any change to any byte gives an
 * unrelated result. It is not cryptographic (a cheater could forge a match);
 * that's fine, it only has to notice accidental drift, and it runs the same,
 * synchronously, in Node and every browser (crypto.subtle's SHA-256 is async
 * in browsers and far slower).
 *
 * Every function takes the hash so far and returns the new one, so calls
 * chain: `h = hashNumber(hashString(FNV_OFFSET, "y"), 85.5)`.
 */

/** The starting value of an FNV-1a 32-bit hash. */
export const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Fold one byte (0–255) into the hash. */
export function hashByte(h: number, byte: number): number {
  return Math.imul(h ^ byte, FNV_PRIME) >>> 0;
}

/** Fold a string in: each UTF-16 code unit as two bytes, low byte first. */
export function hashString(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = hashByte(hashByte(h, c & 0xff), c >>> 8);
  }
  return h;
}

/** Scratch space for hashNumber (reused: no allocation per number). */
const BYTES = new DataView(new ArrayBuffer(8));

/**
 * Fold one number into the hash: its exact 64-bit float value, so two numbers
 * that differ in the last bit hash differently.
 *
 * A JS number is stored as 8 bytes; we write it into an 8-byte buffer and
 * fold the bytes in lowest first ("little-endian", the order phones and PCs
 * use). Hashing `String(x)` instead would also be exact for most numbers,
 * but slower, and blind to -0 (prints "0" though its bits differ).
 */
export function hashNumber(h: number, x: number): number {
  BYTES.setFloat64(0, x, true);
  for (let i = 0; i < 8; i++) h = hashByte(h, BYTES.getUint8(i));
  return h;
}

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

/**
 * Fold one number into the hash: its exact 64-bit float value, so two numbers
 * that differ in the last bit hash differently.
 *
 * YOUR TURN (owner, NETCODE S0 step 2). The rule the tests in hash.test.ts
 * check: take the 8 bytes of `x` as a 64-bit float in **little-endian** order
 * (lowest byte first) and fold each one in with `hashByte`, first to last.
 * Then remove `.skip` from the "hashNumber (owner)" tests and run
 * `npx vitest run src/sim/hash.test.ts`.
 *
 * Until then this placeholder hashes the number's text. `String(x)` is exact
 * too (JS prints the shortest digits that read back as the same 64 bits), but
 * it is slower and has one blind spot the tests will show you.
 */
export function hashNumber(h: number, x: number): number {
  return hashString(h, String(x));
}

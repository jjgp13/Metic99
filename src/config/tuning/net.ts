// Netcode: how two copies of a field check they still agree (docs/NETCODE.md).
// Re-exported by config/constants.ts; see docs/ENGINEERING.md §3.

export const NET = {
  // Steps between state fingerprints (60 = once per game second). A mismatch
  // then lands within 1 s of its cause, and the list stays short enough to
  // read on a phone.
  FINGERPRINT_EVERY: 60,
} as const;

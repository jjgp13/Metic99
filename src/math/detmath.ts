/**
 * Deterministic math for game rules (docs/NETCODE.md, S0 step 4).
 *
 * The server re-runs every player's field and compares state fingerprints
 * with the client's, so a rule step must give the same bits on every JS
 * engine. `+ - * /`, `%`, `Math.sqrt`, `floor`/`trunc`/`abs`/`min`/`max` are
 * exact (the spec fixes the result), but `Math.sin`, `Math.exp`, `Math.pow`
 * / `**` and the other transcendental functions are only
 * "implementation-approximated", and engines differ: measured in S0, Node 24
 * and Chrome 152/155 (both V8!) disagree in the last bit on 3% of the `sin`
 * and 10% of the `exp` inputs the rules use.
 *
 * So the rules call `sin`, `cos`, `exp`, `atan`, `atan2` and `hypot` from
 * here instead: ports of fdlibm
 * (Sun's freely distributable math library, the algorithms V8 started from)
 * written with exact operations only, so every engine computes the same
 * bits. They also give exactly Node 24's answers on every input the S0
 * recording used, so switching to them changed no run. Accuracy: under 1 ulp
 * (one last bit), like fdlibm. `sin`/`cos` reduce the argument with
 * Cody–Waite: accurate for |x| < ~8e5 (game values are far smaller), still
 * deterministic beyond that.
 *
 * How it works, in one line per function: write x as (whole multiples of a
 * constant) + a small remainder, evaluate a short polynomial on the
 * remainder, then put the multiples back. The bit tricks below (hi/withHi)
 * only read or set a double's exponent; they are exact too.
 *
 * The algorithms and constants come from fdlibm:
 *   Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *   Developed at SunPro, a Sun Microsystems, Inc. business.
 *   Permission to use, copy, modify, and distribute this software is freely
 *   granted, provided that this notice is preserved.
 */

// High/low 32-bit words of a double, like fdlibm's __HI / __LO. DataView
// fixes the byte order, so this doesn't depend on the CPU's endianness.
const view = new DataView(new ArrayBuffer(8));

function hi(x: number): number {
  view.setFloat64(0, x);
  return view.getInt32(0);
}

function withHi(x: number, high: number): number {
  view.setFloat64(0, x);
  view.setInt32(0, high);
  return view.getFloat64(0);
}

function fromWords(high: number, low: number): number {
  view.setInt32(0, high);
  view.setInt32(4, low);
  return view.getFloat64(0);
}

// ---------------------------------------------------------------------------
// exp (fdlibm e_exp.c)
// ---------------------------------------------------------------------------
const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700e0;
const O_THRESHOLD = 7.09782712893383973096e2;
const U_THRESHOLD = -7.45133219101941108420e2;
const TWO_M1000 = 9.33263618503218878990e-302; // 2^-1000
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

function detExp(x: number): number {
  const hx = hi(x);
  const neg = hx < 0;
  const ix = hx & 0x7fffffff;

  if (ix >= 0x40862e42) {
    // |x| >= 709.78: NaN, ±Infinity, overflow or underflow.
    if (Number.isNaN(x)) return x;
    if (x === Infinity) return Infinity;
    if (x === -Infinity) return 0;
    if (x > O_THRESHOLD) return Infinity;
    if (x < U_THRESHOLD) return 0;
  }

  // Reduce: x = k·ln2 + r with |r| <= ln2/2, r kept as hi - lo.
  let k = 0;
  let rHi = 0;
  let rLo = 0;
  let r = x;
  if (ix > 0x3fd62e42) {
    if (ix < 0x3ff0a2b2) {
      // 0.5·ln2 < |x| < 1.5·ln2: k = ±1
      k = neg ? -1 : 1;
      rHi = neg ? x + LN2_HI : x - LN2_HI;
      rLo = neg ? -LN2_LO : LN2_LO;
    } else {
      k = Math.trunc(INV_LN2 * x + (neg ? -0.5 : 0.5));
      rHi = x - k * LN2_HI; // exact: LN2_HI has trailing zero bits
      rLo = k * LN2_LO;
    }
    r = rHi - rLo;
  } else if (ix < 0x3e300000) {
    return 1 + x; // |x| < 2^-28
  }

  const t = r * r;
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((r * c) / (c - 2) - r);
  const y = 1 - (rLo - (r * c) / (2 - c) - rHi);
  // Scale by 2^k by adding k to the exponent bits.
  if (k >= -1021) return withHi(y, hi(y) + (k << 20));
  return withHi(y, hi(y) + ((k + 1000) << 20)) * TWO_M1000;
}

// ---------------------------------------------------------------------------
// sin / cos (fdlibm s_sin.c, s_cos.c, k_sin.c, k_cos.c, e_rem_pio2.c)
// ---------------------------------------------------------------------------
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

/** sin on [-π/4, π/4]; `y` is the tail of the reduced argument. */
function kernelSin(x: number, y: number, hasTail: boolean): number {
  if ((hi(x) & 0x7fffffff) < 0x3e400000) return x; // |x| < 2^-27
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (!hasTail) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** cos on [-π/4, π/4]; `y` is the tail of the reduced argument. */
function kernelCos(x: number, y: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000) return 1; // |x| < 2^-27
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y)); // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0); // x/4, truncated
  const hz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417e0; // first 33 bits of π/2
const PIO2_1T = 6.07710050650619224932e-11; // π/2 - PIO2_1
const PIO2_2 = 6.07710050630396597660e-11; // next 33 bits
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21; // next 33 bits
const PIO2_3T = 8.47842766036889956997e-32;

/**
 * x = n·π/2 + (y0 + y1) with |y0 + y1| <= π/4 (Cody–Waite, with up to three
 * pieces of π/2 when x is close to a multiple of it). Returns n mod 4.
 */
function remPio2(x: number, y: [number, number]): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    // |x| < 3π/4: n = ±1
    const sign = hx > 0 ? 1 : -1;
    let z = x - sign * PIO2_1;
    if (ix !== 0x3ff921fb) {
      y[0] = z - sign * PIO2_1T;
      y[1] = z - y[0] - sign * PIO2_1T;
    } else {
      z -= sign * PIO2_2; // x is π/2 to 33 bits: use more of π/2
      y[0] = z - sign * PIO2_2T;
      y[1] = z - y[0] - sign * PIO2_2T;
    }
    return sign > 0 ? 1 : 3;
  }

  const t = Math.abs(x);
  const n = Math.trunc(t * INV_PIO2 + 0.5);
  let r = t - n * PIO2_1;
  let w = n * PIO2_1T;
  const j = ix >> 20;
  y[0] = r - w;
  if (j - ((hi(y[0]) >> 20) & 0x7ff) > 16) {
    // Cancellation: x is close to a multiple of π/2.
    let t2 = r;
    w = n * PIO2_2;
    r = t2 - w;
    w = n * PIO2_2T - (t2 - r - w);
    y[0] = r - w;
    if (j - ((hi(y[0]) >> 20) & 0x7ff) > 49) {
      t2 = r;
      w = n * PIO2_3;
      r = t2 - w;
      w = n * PIO2_3T - (t2 - r - w);
      y[0] = r - w;
    }
  }
  y[1] = r - y[0] - w;
  const q = n % 4;
  if (hx < 0) {
    y[0] = -y[0];
    y[1] = -y[1];
    return (4 - q) % 4;
  }
  return q;
}

const reduced: [number, number] = [0, 0];

function detSin(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, false); // |x| <= π/4
  if (!Number.isFinite(x)) return NaN;
  switch (remPio2(x, reduced)) {
    case 0:
      return kernelSin(reduced[0], reduced[1], true);
    case 1:
      return kernelCos(reduced[0], reduced[1]);
    case 2:
      return -kernelSin(reduced[0], reduced[1], true);
    default:
      return -kernelCos(reduced[0], reduced[1]);
  }
}

function detCos(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0);
  if (!Number.isFinite(x)) return NaN;
  switch (remPio2(x, reduced)) {
    case 0:
      return kernelCos(reduced[0], reduced[1]);
    case 1:
      return -kernelSin(reduced[0], reduced[1], true);
    case 2:
      return -kernelCos(reduced[0], reduced[1]);
    default:
      return kernelSin(reduced[0], reduced[1], true);
  }
}

// ---------------------------------------------------------------------------
// atan / atan2 (fdlibm s_atan.c, e_atan2.c): added for the story levels'
// Cave Troll lamp (angles to the lamp).
// ---------------------------------------------------------------------------
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800e0];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];

function detAtan(x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    // |x| >= 2^66 (or NaN): ±π/2
    if (Number.isNaN(x)) return x;
    return hx > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  }
  let id: number;
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e200000) return x; // |x| < 2^-29
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      // |x| < 1.1875
      if (ix < 0x3fe60000) {
        id = 0; // 7/16 <= |x| < 11/16
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1; // 11/16 <= |x| < 19/16
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2; // |x| < 2.4375
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3; // 2.4375 <= |x| < 2^66
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATAN_HI[id] - (x * (s1 + s2) - ATAN_LO[id] - x);
  return hx < 0 ? -r : r;
}

const PI = 3.1415926535897931160e0;
const PI_LO = 1.2246467991473531772e-16;
const PI_O_2 = 1.5707963267948965580e0;
const PI_O_4 = 7.8539816339744827900e-1;

/** The angle of the point (x, y), like Math.atan2(y, x). */
function detAtan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return x + y;
  if (x === 1) return detAtan(y);
  // 2·sign(x) + sign(y), signs read from the bits (so -0 counts as negative).
  const m = (hi(y) < 0 ? 1 : 0) | (hi(x) < 0 ? 2 : 0);
  if (y === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
  if (x === 0) return y < 0 ? -PI_O_2 : PI_O_2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) return [PI_O_4, -PI_O_4, 3 * PI_O_4, -3 * PI_O_4][m];
    return [0, -0, PI, -PI][m];
  }
  if (!Number.isFinite(y)) return y < 0 ? -PI_O_2 : PI_O_2;
  const k = ((hi(y) & 0x7fffffff) - (hi(x) & 0x7fffffff)) >> 20;
  let z: number;
  if (k > 60) z = PI_O_2 + 0.5 * PI_LO; // |y/x| > 2^60
  else if (x < 0 && k < -60) z = 0; // |y|/x < -2^60
  else z = detAtan(Math.abs(y / x));
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

/** sqrt(x² + y²) with exact operations (Math.hypot may round differently). */
function detHypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** The deterministic implementations, whatever the mode. */
export const DET = { sin: detSin, cos: detCos, exp: detExp, atan: detAtan } as const;

/**
 * Lab only: route the rules through the engine's Math again (the code as it
 * was before S0) to show how engines drift with it (`?lab=determinism`).
 * Never on in play. A module flag, not game state: it never changes during
 * a run and the fingerprint doesn't need it.
 */
let native = false;

export function useNativeMath(on: boolean): void {
  native = on;
}

export function sin(x: number): number {
  return native ? Math.sin(x) : detSin(x);
}

export function cos(x: number): number {
  return native ? Math.cos(x) : detCos(x);
}

export function exp(x: number): number {
  return native ? Math.exp(x) : detExp(x);
}

export function atan(x: number): number {
  return native ? Math.atan(x) : detAtan(x);
}

export function atan2(y: number, x: number): number {
  return native ? Math.atan2(y, x) : detAtan2(y, x);
}

export function hypot(x: number, y: number): number {
  return native ? Math.hypot(x, y) : detHypot(x, y);
}

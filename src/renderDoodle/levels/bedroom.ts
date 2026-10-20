import { BALL_LAYOUTS, DOODLE } from "../../config/constants";
import { BOUNCE } from "../../config/levels/bedroom";
import type Alien from "../../objects/Alien";
import {
  Bounce,
  JackInTheBox,
  LoopTheLoop,
  Nap,
  Windup,
  type BouncePhase,
  type NapPhase,
  type WindPhase,
} from "../../objects/bedroom";
import type { CreatureLook, PageDef } from "../pages";
import type { DoodleRecipe, Point } from "../pencil";

/**
 * Level 10, THE KID'S BEDROOM (config/levels/bedroom.ts): warm lamp-lit
 * paper with toy blocks, crayons, socks, a braided rug and a night light;
 * toys that come alive (wind-up soldiers, jacks-in-the-box, rubber balls,
 * teddy bears, a paper plane) and the bed with something under it. Toys
 * are pinks, lavenders, teals and oranges: red, yellow, green and blue mean
 * math operations (docs/ART_SPEC.md §4), so they stay off the toys.
 */

const TAU = Math.PI * 2;
const C = {
  pink: "#d98bb0",
  lavender: "#a58fd0",
  teal: "#2f8f8a",
  orange: "#e8873a",
  wood: "#b98a5a",
  fur: "#9a6a44",
  tan: "#d9b48a",
  dark: "#3b2a4a",
  monster: "#7a4f9a",
  horn: "#e8a35a",
  glow: "#ffcf8a",
  plum: "#6e3f73",
};

// --- Props --------------------------------------------------------------------

/** A wooden toy block with a letter on it (letters, never digits). */
function block(letter: "A" | "B" | "C", ink: string): DoodleRecipe {
  return {
    w: 34,
    h: 34,
    draw(p) {
      p.shape(
        [
          [-12, -12],
          [12, -12],
          [12, 12],
          [-12, 12],
        ],
        ink,
        { hachureGap: 3.2 },
      );
      p.shape(
        [
          [-7, -7],
          [7, -7],
          [7, 7],
          [-7, 7],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 0.8 },
      );
      if (letter === "A") {
        p.line(-4, 5, 0, -5, { strokeWidth: 1.4 });
        p.line(0, -5, 4, 5, { strokeWidth: 1.4 });
        p.line(-2, 1, 2, 1, { strokeWidth: 1.2 });
      } else if (letter === "B") {
        p.line(-3, -5, -3, 5, { strokeWidth: 1.4 });
        p.curve(
          [
            [-3, -5],
            [3, -3],
            [-3, 0],
          ],
          { strokeWidth: 1.2 },
        );
        p.curve(
          [
            [-3, 0],
            [4, 2.5],
            [-3, 5],
          ],
          { strokeWidth: 1.2 },
        );
      } else {
        p.curve(
          [
            [4, -4],
            [-3, -5],
            [-4, 0],
            [-3, 5],
            [4, 4],
          ],
          { strokeWidth: 1.4 },
        );
      }
    },
  };
}

const CRAYON: DoodleRecipe = {
  w: 50,
  h: 18,
  draw(p) {
    p.shape(
      [
        [-18, -4],
        [12, -4],
        [12, 4],
        [-18, 4],
      ],
      C.lavender,
      { hachureGap: 2.2 },
    );
    p.shape(
      [
        [12, -4],
        [20, 0],
        [12, 4],
      ],
      C.lavender,
      { fillStyle: "solid", strokeWidth: 0.9 },
    );
    p.line(-12, -4, -12, 4, { strokeWidth: 0.9 }); // the paper wrapper's edge
    p.line(6, -4, 6, 4, { strokeWidth: 0.9 });
  },
};

const SOCK: DoodleRecipe = {
  w: 36,
  h: 44,
  draw(p) {
    p.shape(
      [
        [-6, -18],
        [6, -18],
        [6, 6],
        [12, 10],
        [10, 18],
        [-4, 16],
        [-6, 10],
      ],
      C.pink,
      { hachureGap: 2.8 },
    );
    for (const y of [-12, -6]) p.line(-6, y, 6, y, { stroke: C.teal, strokeWidth: 1.4 }); // stripes
  },
};

const RUG: DoodleRecipe = {
  w: 96,
  h: 54,
  draw(p) {
    // A braided oval rug: rings in turn.
    for (const [w, h, ink] of [
      [88, 46, C.orange],
      [66, 34, C.pink],
      [44, 22, C.lavender],
    ] as const) {
      p.ellipse(0, 0, w, h, undefined, { stroke: ink, strokeWidth: 2 });
    }
    p.ellipse(0, 0, 20, 9, undefined, { stroke: C.teal, strokeWidth: 1.6 });
  },
};

/** The night light: a moon plugged into the wall, glowing. */
const NIGHT_LIGHT: DoodleRecipe = {
  w: 46,
  h: 46,
  draw(p) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(Math.cos(a) * 14, Math.sin(a) * 14, Math.cos(a) * 19, Math.sin(a) * 19, {
        stroke: C.glow,
        strokeWidth: 1.2,
      });
    }
    p.curve(
      [
        [2, -11],
        [-9, -6],
        [-9, 6],
        [2, 11],
        [-3, 4],
        [-4, -3],
        [2, -11],
      ],
      { fill: C.glow, fillStyle: "solid", strokeWidth: 1.2 },
    );
    p.dot(4, 0, 1.2); // the plug's screw
  },
};

const STAR_STICKER: DoodleRecipe = {
  w: 26,
  h: 26,
  draw(p) {
    const pts: Point[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 === 0 ? 10 : 4.5;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    p.shape(pts, C.glow, { hachureGap: 2.2 });
  },
};

// --- Toys ------------------------------------------------------------------------

/** A wind-up key with its two loops, turned `turn` radians, at (x, y). */
function windKey(p: Parameters<DoodleRecipe["draw"]>[0], x: number, y: number, turn: number): void {
  const c = Math.cos(turn) * 6;
  p.line(x, y, x + 6, y, { strokeWidth: 1.3 }); // the stem
  p.ellipse(x + 9, y - 3, 6, Math.abs(c) + 2, undefined, { strokeWidth: 1.1 });
  p.ellipse(x + 9, y + 3, 6, Math.abs(c) + 2, undefined, { strokeWidth: 1.1 });
}

const KEY_POSES = 4;
const keyPose = (a: Alien) => (a.ability instanceof Windup ? Math.abs(Math.round(a.ability.key / (TAU / KEY_POSES))) % KEY_POSES : 0);
const windPhase = (a: Alien): WindPhase => (a.ability instanceof Windup ? a.ability.phase : "march");

/**
 * Wind-up soldier: a tall hat whose badge is one number and a drum held up
 * in front of his face that is the other (the chain layout), boots under it
 * and a wind-up key in his back that turns. Marching, his boots step; run
 * down, he leans; stopped, the key is being wound ("click").
 */
function soldierDoodle(phase: WindPhase, pose: number): DoodleRecipe {
  const L = BALL_LAYOUTS.chain;
  const drum = L.FIRST_Y;
  const badge = L.FIRST_Y - L.GAP;
  return {
    w: 48,
    h: 2 * 50,
    draw(p, t) {
      const step = phase === "march" ? Math.sin(TAU * t) * 3 : 0;
      for (const side of [-1, 1]) {
        const lift = side * step;
        p.line(side * 4, drum + 8, side * 5, drum + 18 + lift, { strokeWidth: 2 }); // legs
        p.ellipse(side * 6, drum + 20 + lift, 8, 5, DOODLE.GRAPHITE, { fillStyle: "solid" }); // boots
      }
      // Coat and arms holding the drum up.
      p.shape(
        [
          [-9, badge + 10],
          [9, badge + 10],
          [10, drum + 10],
          [-10, drum + 10],
        ],
        C.teal,
        { hachureGap: 2.2 },
      );
      for (const side of [-1, 1]) {
        p.line(side * 10, badge + 12, side * 13, drum, { stroke: C.teal, strokeWidth: 2.4 });
        p.line(side * 12, drum - 4, side * 2, drum - 12, { stroke: C.wood, strokeWidth: 1.2 }); // drumsticks
      }
      p.ellipse(0, drum, 26, 22, C.pink, { hachureGap: 2.6 }); // the drum
      p.line(-11, drum - 5, 11, drum + 5, { strokeWidth: 0.8 }); // its cords
      p.line(-11, drum + 5, 11, drum - 5, { strokeWidth: 0.8 });
      // The tall hat with its badge, a brim and a plume.
      p.shape(
        [
          [-10, badge + 10],
          [-11, badge - 12],
          [11, badge - 12],
          [10, badge + 10],
        ],
        DOODLE.GRAPHITE,
        { hachureGap: 1.8 },
      );
      p.line(-12, badge + 10, 12, badge + 10, { strokeWidth: 1.8 }); // the brim
      p.curve(
        [
          [0, badge - 12],
          [3, badge - 19],
          [-1, badge - 23],
        ],
        { stroke: C.orange, strokeWidth: 2.2 },
      ); // the plume
      windKey(p, 11, drum + 2, (pose * TAU) / KEY_POSES);
      if (phase === "slow") {
        p.curve(
          [
            [-16, drum + 14],
            [-20, drum + 10],
            [-18, drum + 6],
          ],
          { strokeWidth: 0.9 },
        ); // a weary wobble mark
      }
      if (phase === "stop") {
        p.line(22, drum - 8, 26, drum - 12, { strokeWidth: 0.9 }); // "click, click"
        p.line(23, drum - 3, 28, drum - 4, { strokeWidth: 0.9 });
      }
    },
  };
}

const SOLDIER: CreatureLook = {
  variant: (a) => `${windPhase(a)}:${keyPose(a)}`,
  recipe: (a) => soldierDoodle(windPhase(a), keyPose(a)),
};

/**
 * Jack-in-the-box: shut, a toy box with a star on the front and a crank
 * handle at its side (it shakes before it pops); out, a clown's head on a
 * spring whose two eyes are the numbers, a pointy hat and a frilly collar.
 */
function jackDoodle(state: "shut" | "shake" | "out"): DoodleRecipe {
  const E = BALL_LAYOUTS.eyes;
  return {
    w: 2 * 40,
    h: 2 * 44,
    draw(p, t) {
      const jiggle = state === "shake" ? Math.sin(TAU * t * 3) * 2 : 0;
      const turn = Math.sin(TAU * t) * 5;
      /** The box (top edge y0, bottom y1) with its crank handle at the side. */
      const box = (y0: number, y1: number, dx: number) => {
        p.shape(
          [
            [-19 + dx, y0],
            [19 + dx, y0],
            [19, y1],
            [-19, y1],
          ],
          C.lavender,
          { hachureGap: 2.8 },
        );
        const cy = (y0 + y1) / 2;
        p.line(19, cy, 27, cy, { strokeWidth: 1.4 });
        p.line(27, cy, 27 + turn * 0.4, cy + turn, { strokeWidth: 1.4 });
        p.dot(27 + turn * 0.4, cy + turn, 1.8, C.orange);
      };
      if (state !== "out") {
        box(-12, 24, jiggle);
        p.line(-19 + jiggle, -12, 19 + jiggle, -12, { strokeWidth: 2 }); // the shut lid
        p.shape(
          [
            [0 + jiggle, 0],
            [3, 6],
            [9, 7],
            [4, 11],
            [6, 17],
            [0, 13],
            [-6, 17],
            [-4, 11],
            [-9, 7],
            [-3, 6],
          ],
          C.orange,
          { hachureGap: 1.8, strokeWidth: 1 },
        ); // a star on the front
        if (state === "shake") for (const side of [-1, 1]) p.line(side * 24, -16, side * 28, -20, { strokeWidth: 1 });
        return;
      }
      // Out: the box below him with its lid flung open, the clown's head on
      // top in a frilly collar, a pointy hat.
      box(22, 38, 0);
      p.line(-19, 22, -31, 8, { strokeWidth: 2 }); // the open lid
      p.ellipse(0, E.EYE_Y - 2, 54, 40, C.tan, { hachureGap: 3 }); // the head
      for (let i = 0; i < 7; i++) {
        const x = -21 + i * 7;
        p.circle(x, E.EYE_Y + 17, 9, C.pink, { hachureGap: 2, strokeWidth: 0.9 }); // the frilly collar
      }
      p.shape(
        [
          [-13, E.EYE_Y - 18],
          [0, E.EYE_Y - 40],
          [13, E.EYE_Y - 18],
        ],
        C.orange,
        { hachureGap: 2.2 },
      ); // the pointy hat
      p.circle(0, E.EYE_Y - 41, 6, C.pink, { fillStyle: "solid" }); // its pompom
      p.dot(0, E.EYE_Y + 9, 2.4, C.pink); // a round nose under the eyes
    },
  };
}

const JACK_SHUT = jackDoodle("shut");
const JACK_SHAKE = jackDoodle("shake");
const JACK_OUT = jackDoodle("out");
const jackState = (a: Alien): "shut" | "shake" | "out" => {
  const jack = a.ability instanceof JackInTheBox ? a.ability : null;
  if (!jack || jack.phase === "pop" || jack.phase === "open") return "out";
  if (jack.phase === "duck") return jack.cover < 0.5 ? "out" : "shut";
  return jack.shaking(a) ? "shake" : "shut";
};

const JACK: CreatureLook = {
  variant: jackState,
  recipe: (a) => ({ shut: JACK_SHUT, shake: JACK_SHAKE, out: JACK_OUT })[jackState(a)],
  coverInk: C.lavender, // the lid closing over his eyes
  hidesBalls: true, // shut, he is all inside the box
};

/** How high in its bounce the ball is drawn (0..ARCS), and its phase. */
const ARCS = 3;
const bounceOf = (a: Alien): [BouncePhase, number] => {
  if (!(a.ability instanceof Bounce)) return ["roll", 0];
  const b = a.ability;
  return [b.phase, b.phase === "air" ? Math.round(Math.sin(Math.PI * b.progress) * ARCS) : 0];
};

/**
 * Rubber ball: a big striped ball whose two painted spots are its numbers.
 * Its shadow on the floor drops away below it while it is in the air (so it
 * looks high up), and it squashes flat on each landing.
 */
function ballDoodle(phase: BouncePhase, height: number): DoodleRecipe {
  const E = BALL_LAYOUTS.eyes;
  return {
    w: 2 * 34,
    h: 2 * 46,
    draw(p, t) {
      const cy = E.EYE_Y - 2;
      const squash = phase === "squash" ? 1.12 : 1;
      const lift = (height / ARCS) * BOUNCE.ARC_PX;
      // The shadow: further below (and fainter) the higher the ball is.
      p.ellipse(0, cy + 24 + lift, 34 - lift, 8, undefined, { stroke: DOODLE.GRAPHITE_LIGHT, strokeWidth: 1 });
      p.ellipse(0, cy, 46 * squash, 46 / squash, C.orange, { hachureGap: 3, hachureAngle: 30 });
      p.curve(
        [
          [-22 * squash, cy - 8],
          [0, cy - 15 / squash],
          [22 * squash, cy - 8],
        ],
        { stroke: C.teal, strokeWidth: 3 },
      ); // a painted stripe over the top
      p.curve(
        [
          [-21 * squash, cy + 12],
          [0, cy + 19 / squash],
          [21 * squash, cy + 12],
        ],
        { stroke: C.teal, strokeWidth: 3 },
      );
      p.curve(
        [
          [-12, cy - 15],
          [-8, cy - 18],
          [-3, cy - 19],
        ],
        { stroke: DOODLE.PAPER, strokeWidth: 2 },
      ); // its shine
      if (phase === "roll") {
        const spin = Math.sin(TAU * t) * 3;
        for (const y of [-10, 4]) p.line(-34, cy + y + spin, -26, cy + y, { strokeWidth: 0.9 }); // rolling in
      }
      if (phase === "squash") for (const side of [-1, 1]) p.line(side * 26, cy + 20, side * 32, cy + 22, { strokeWidth: 1 }); // "boing"
    },
  };
}

const BALL: CreatureLook = {
  variant: (a) => bounceOf(a).join(":"),
  recipe: (a) => ballDoodle(...bounceOf(a)),
};

const napPhase = (a: Alien): NapPhase => (a.ability instanceof Nap ? a.ability.phase : "waddle");

/**
 * Teddy bear: a plump brown bear on its way down the page, head first, its
 * three tummy buttons the numbers (the cluster layout), with a patched ear.
 * It yawns (mouth open), then naps with its eyes shut and a "z z".
 */
function teddyDoodle(phase: NapPhase): DoodleRecipe {
  const L = BALL_LAYOUTS.cluster;
  const top = L.FIRST_Y - L.GAP_Y; // the higher button
  return {
    w: 2 * 40,
    h: 2 * 52,
    draw(p, t) {
      const awake = phase !== "nap";
      const swing = awake ? Math.sin(TAU * t) * 3 : 0;
      for (const side of [-1, 1]) {
        p.ellipse(side * 15, top - 14 + side * swing, 14, 14, C.fur, { hachureGap: 2.4 }); // feet (up the page)
        p.ellipse(side * 15, top - 15 + side * swing, 7, 7, C.tan, { fillStyle: "solid", strokeWidth: 0.8 }); // paw pads
        p.ellipse(side * 30, L.FIRST_Y - 8 - side * swing, 14, 26, C.fur, { hachureGap: 2.4 }); // arms
      }
      p.ellipse(0, L.FIRST_Y - 10, 58, 62, C.fur, { hachureGap: 2.6 }); // tummy
      p.ellipse(0, L.FIRST_Y - 10, 44, 48, C.tan, { hachureGap: 3.4, strokeWidth: 0.9 });
      const head = L.FIRST_Y + 24;
      for (const side of [-1, 1]) p.circle(side * 14, head + 11, 11, side < 0 ? C.pink : C.fur, { hachureGap: 2 }); // ears, one patched
      p.ellipse(0, head, 36, 30, C.fur, { hachureGap: 2.4 }); // head, facing the player
      p.ellipse(0, head + 6, 16, 12, C.tan, { fillStyle: "solid", strokeWidth: 0.9 }); // muzzle
      p.dot(0, head + 3, 2.2); // nose
      if (awake) {
        for (const side of [-1, 1]) p.dot(side * 8, head - 3, 1.8); // button eyes
      } else {
        for (const side of [-1, 1]) p.line(side * 5, head - 3, side * 11, head - 3, { strokeWidth: 1.4 }); // asleep
      }
      if (phase === "yawn") p.ellipse(0, head + 11, 7, 6, DOODLE.GRAPHITE, { fillStyle: "solid" });
      if (phase === "nap") {
        // "z z": little zigzags floating up beside it.
        for (const [x, y, s] of [
          [26, head - 6, 4],
          [33, head - 16, 6],
        ]) {
          p.line(x, y, x + s, y, { strokeWidth: 1 });
          p.line(x + s, y, x, y + s, { strokeWidth: 1 });
          p.line(x, y + s, x + s, y + s, { strokeWidth: 1 });
        }
      }
    },
  };
}

const TEDDY: CreatureLook = {
  variant: (a) => napPhase(a),
  recipe: (a) => teddyDoodle(napPhase(a)),
};

/**
 * Paper plane: seen from behind as it flies across, a number on each wing,
 * with speed lines trailing behind it; looping, a swoosh curls round it.
 */
function planeDoodle(heading: 1 | -1, looping: boolean): DoodleRecipe {
  const W = BALL_LAYOUTS.wings;
  return {
    w: 2 * 50,
    h: 2 * 40,
    draw(p) {
      for (const side of [-1, 1]) {
        p.shape(
          [
            [side * 3, W.WING_Y - 15],
            [side * 40, W.WING_Y - 2],
            [side * 3, W.WING_Y + 14],
          ],
          DOODLE.PAPER,
          { fillStyle: "solid" },
        );
        p.line(side * 4, W.WING_Y + 3, side * 34, W.WING_Y - 1, { stroke: C.lavender, strokeWidth: 0.9 }); // a fold line
      }
      p.shape(
        [
          [-3, W.WING_Y - 6],
          [0, W.WING_Y + 26],
          [3, W.WING_Y - 6],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid" },
      ); // the keel
      if (looping) {
        p.curve(
          [
            [-heading * 36, 16],
            [-heading * 44, -6],
            [-heading * 28, -30],
            [heading * 8, -34],
            [heading * 30, -20],
          ],
          { stroke: C.lavender, strokeWidth: 1.2 },
        );
      } else {
        for (const y of [-10, 0, 10]) p.line(-heading * 44, W.WING_Y + y, -heading * 50, W.WING_Y + y, { strokeWidth: 0.9 });
      }
    },
  };
}

const planeState = (a: Alien): [1 | -1, boolean] => [a.heading, a.ability instanceof LoopTheLoop && a.ability.loop !== null];

const PLANE: CreatureLook = {
  variant: (a) => planeState(a).join(":"),
  recipe: (a) => planeDoodle(...planeState(a)),
};

// --- Boss: the UNDER-THE-BED MONSTER ------------------------------------------------

/** The bed, seen from above: a patchwork quilt, a pillow at the end nearest
 * the player, bedposts, and a frilly bedskirt along the far edge, where the
 * dark under the bed spills out. `y0` is the top of the quilt. */
function bed(p: Parameters<DoodleRecipe["draw"]>[0], y0: number, wobble: number): void {
  const x0 = -54;
  const x1 = 54;
  const y1 = 32;
  p.shape(
    [
      [x0, y0],
      [x1, y0],
      [x1 + 2, y1],
      [x0 - 2, y1],
    ],
    C.pink,
    { hachureGap: 3.4 },
  );
  // Patchwork: lavender squares on the pink quilt, every other one.
  const cols = 6;
  const rows = 2;
  const cw = (x1 - x0) / cols;
  const ch = (y1 - 14 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = (r % 2) as number; c < cols; c += 2) {
      const x = x0 + c * cw;
      const y = y0 + r * ch;
      p.shape(
        [
          [x + 1, y + 1],
          [x + cw - 1, y + 1],
          [x + cw - 1, y + ch - 1],
          [x + 1, y + ch - 1],
        ],
        C.lavender,
        { hachureGap: 2.4, strokeWidth: 0.8 },
      );
    }
  }
  p.ellipse(0, y1 - 6, 52, 14, DOODLE.PAPER, { fillStyle: "solid" }); // the pillow
  for (const [x, y] of [
    [x0 - 2, y0],
    [x1 + 2, y0],
    [x0 - 2, y1],
    [x1 + 2, y1],
  ])
    p.circle(x, y, 9, C.wood, { fillStyle: "solid" }); // bedposts
  // The frilly bedskirt along the far edge.
  for (let i = 0; i < 9; i++) {
    const x = x0 + 6 + i * 12;
    p.curve(
      [
        [x - 6, y0],
        [x, y0 - 5 - wobble * (i % 2)],
        [x + 6, y0],
      ],
      { strokeWidth: 1 },
    );
  }
}

/** The dark spilling out from under the bed, ragged, with clawed fingers
 * gripping the edge at both ends. `eyes`: glow marks around the eyes. */
function darkness(p: Parameters<DoodleRecipe["draw"]>[0], eyesY: number, reach: number, eyes: boolean): void {
  const top = eyesY - 18 - reach;
  p.shape(
    [
      [-52, eyesY + 16],
      [-50, eyesY - 4],
      [-40, top + 6],
      [-26, top],
      [-14, top + 5],
      [0, top - 2],
      [14, top + 5],
      [26, top],
      [40, top + 6],
      [50, eyesY - 4],
      [52, eyesY + 16],
    ],
    C.dark,
    { fillStyle: "solid", strokeWidth: 1.4 },
  );
  for (const side of [-1, 1]) {
    for (const k of [0, 1, 2]) {
      const x = side * (44 + k * 4);
      p.curve(
        [
          [x, eyesY + 12],
          [x + side * 4, eyesY + 4],
          [x + side * 2, eyesY - 2],
        ],
        { stroke: C.lavender, strokeWidth: 1.6 },
      ); // claws curling over the edge
    }
  }
  if (!eyes) return;
  for (const x of [-20, 0, 20]) {
    for (const a of [-2.2, -1.57, -0.94]) {
      p.line(x + Math.cos(a) * 11, eyesY + Math.sin(a) * 11, x + Math.cos(a) * 14, eyesY + Math.sin(a) * 14, {
        stroke: C.glow,
        strokeWidth: 1,
      }); // the eyes' glow
    }
  }
}

/** Phase 1: the bed creeping closer, the monster's eyes (the numbers, a row
 * at BALLS_Y above the bed's middle) peeking out of the dark under it. */
const UNDER_BED: DoodleRecipe = {
  w: 128,
  h: 2 * 58,
  draw(p, t) {
    const breathe = Math.sin(TAU * t) * 1.5;
    darkness(p, -30, breathe, true);
    bed(p, -14, 1);
  },
};

/** Scooting across after an answer: the eyes gone, speed lines either side. */
const UNDER_BED_SCOOT: DoodleRecipe = {
  w: 140,
  h: 2 * 58,
  draw(p, t) {
    darkness(p, -30, 0, false);
    bed(p, -14, 2 + Math.sin(TAU * t) * 2);
    for (const side of [-1, 1]) {
      for (const y of [-8, 6, 20]) p.line(side * 60, y, side * 68, y, { strokeWidth: 1 });
    }
  },
};

/** Phase 2: out in full. A big purple fur ball with three eyes (the
 * numbers), orange horns (one wearing a stolen sock), a wide toothy grin,
 * claws and feet. */
const MONSTER: DoodleRecipe = {
  w: 140,
  h: 2 * 60,
  draw(p, t) {
    const sway = Math.sin(TAU * t) * 3;
    const fur: Point[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const r = i % 2 === 0 ? 1 : 0.9;
      fur.push([Math.cos(a) * 54 * r, -4 + Math.sin(a) * 44 * r]);
    }
    for (const side of [-1, 1]) {
      p.ellipse(side * 26, 38, 26, 14, C.monster, { hachureGap: 2 }); // feet
      p.shape(
        [
          [side * 48, -6],
          [side * (64 + sway), 6],
          [side * 60, 20],
          [side * 46, 14],
        ],
        C.monster,
        { hachureGap: 2.4 },
      ); // arms
      for (const k of [0, 1, 2]) p.line(side * (58 + k * 3), 20, side * (60 + k * 3), 27, { stroke: C.lavender, strokeWidth: 1.6 }); // claws
      p.shape(
        [
          [side * 22, -40],
          [side * 34, -60],
          [side * 36, -38],
        ],
        C.horn,
        { hachureGap: 1.8 },
      ); // horns
    }
    p.shape(fur, C.monster, { hachureGap: 2.2 });
    // A sock caught on its left horn.
    p.shape(
      [
        [-36, -60],
        [-28, -62],
        [-26, -52],
        [-32, -48],
      ],
      C.teal,
      { fillStyle: "solid", strokeWidth: 0.9 },
    );
    // The grin, with teeth.
    p.curve(
      [
        [-30, 4],
        [0, 22],
        [30, 4],
      ],
      { strokeWidth: 2 },
    );
    for (const x of [-18, -6, 6, 18]) {
      p.shape(
        [
          [x - 4, 9 + Math.abs(x) * -0.2 + 4],
          [x, 18 - Math.abs(x) * 0.25],
          [x + 4, 9 + Math.abs(x) * -0.2 + 4],
        ],
        DOODLE.PAPER,
        { fillStyle: "solid", strokeWidth: 0.9 },
      );
    }
  },
};

/** Leaping across after an answer: crouched, eyes squeezed shut, dust. */
const MONSTER_LEAP: DoodleRecipe = {
  w: 150,
  h: 2 * 56,
  draw(p, t) {
    const puff = Math.sin(TAU * t) * 2;
    p.ellipse(0, 4, 118, 70, C.monster, { hachureGap: 2.2 });
    for (const side of [-1, 1]) {
      p.shape(
        [
          [side * 22, -24],
          [side * 38, -44],
          [side * 38, -22],
        ],
        C.horn,
        { hachureGap: 1.8 },
      );
      for (const x of [20, 0]) {
        p.line(side * x - 6, -26, side * x, -22, { strokeWidth: 1.6 });
        p.line(side * x, -22, side * x + 6, -26, { strokeWidth: 1.6 }); // squeezed-shut eyes
      }
      for (const y of [-6, 10]) p.line(side * 64, y, side * 72, y, { strokeWidth: 1 }); // whoosh
      p.circle(side * (52 + puff), 34, 12, undefined, { stroke: DOODLE.GRAPHITE_LIGHT }); // dust
    }
    p.ellipse(0, 12, 26, 10, DOODLE.GRAPHITE, { fillStyle: "solid" }); // a roar
  },
};

export const BEDROOM_PAGE: PageDef = {
  paper: "#f6e4d2",
  rule: "rgba(150, 110, 130, 0.25)",
  margin: "rgba(214, 84, 84, 0.35)",
  props: [
    { recipe: block("A", C.orange), weight: 1.5 },
    { recipe: block("B", C.teal), weight: 1.5 },
    { recipe: block("C", C.pink), weight: 1.5 },
    { recipe: CRAYON, weight: 2.5 },
    { recipe: SOCK, weight: 2 },
    { recipe: RUG, weight: 1 },
    { recipe: NIGHT_LIGHT, weight: 0.8 },
    { recipe: STAR_STICKER, weight: 2.5 },
  ],
  propGap: 48,
  creatures: {
    "toy soldier": SOLDIER,
    "jack-in-the-box": JACK,
    "rubber ball": BALL,
    "teddy bear": TEDDY,
    "paper plane": PLANE,
  },
  bosses: {
    boss_underbed: { up: UNDER_BED, hidden: UNDER_BED_SCOOT },
    boss_bedmonster: { up: MONSTER, hidden: MONSTER_LEAP },
  },
};

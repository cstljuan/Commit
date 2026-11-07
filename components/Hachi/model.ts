/**
 * Hachi's anatomy and states, the same way Arc was built for Seams: a table of named
 * states, each only saying what differs from rest. The drawing is computed from numbers
 * every frame, so every part springs between poses instead of swapping pictures.
 *
 * Grid: 160 units. Arms are single thick strokes whose roots sit inside the head, so a
 * limb can never look detached, in any pose.
 */

export type EyeMode =
  | 'round'
  | 'happy'
  | 'closed'
  | 'wink'
  | 'x'
  | 'sad'
  | 'lid'
  | 'wide'
  | 'squint'
  | 'confused';

export type ArmPose = 'rest' | 'up' | 'wide' | 'droop' | 'open' | 'think' | 'wave' | 'hug' | 'block' | 'point';
export type KnotPose = 'rest' | 'perk' | 'flick' | 'droop';
export type Sym = 'none' | 'dots' | 'zz' | 'check' | 'bang' | 'q' | 'stop' | 'heart' | 'ink';

export type Cfg = {
  sx: number;
  sy: number;
  rot: number;
  bob: number;
  ew: number;
  eh: number;
  eyes: EyeMode;
  arms: ArmPose;
  knot: KnotPose;
  sym: Sym;
  hop: number;
  shake: number;
  jitter: number;
  pulse: number;
  scan: number;
  spin: number;
  wiggle: number;
  look: [number, number] | null;
  red: number;
  loop: boolean;
  dur: number;
};

const BASE: Cfg = {
  sx: 1,
  sy: 1,
  rot: 0,
  bob: 1,
  ew: 1,
  eh: 1,
  eyes: 'round',
  arms: 'rest',
  knot: 'rest',
  sym: 'none',
  hop: 0,
  shake: 0,
  jitter: 0,
  pulse: 0,
  scan: 0,
  spin: 0,
  wiggle: 0,
  look: null,
  red: 0,
  loop: false,
  dur: 1400,
};

const state = (s: Partial<Cfg>): Cfg => ({ ...BASE, ...s });

export const STATES = {
  idle: state({ loop: true }),
  bored: state({ sy: 0.97, rot: 4, bob: 0.4, eyes: 'lid', knot: 'droop', arms: 'droop', look: [-8, 6], loop: true }),
  waiting: state({ bob: 0.6, scan: 1, loop: true }),
  thinking: state({ rot: -4, bob: 0.5, ew: 0.9, eh: 0.85, look: [-6, -7], arms: 'think', sym: 'dots', loop: true }),
  talk: state({ bob: 1.2, pulse: 1, loop: true }),
  sleep: state({ sx: 1.06, sy: 0.92, rot: 7, bob: 0.35, eyes: 'closed', arms: 'droop', knot: 'droop', sym: 'zz', loop: true }),
  squeeze: state({ sx: 1.16, sy: 0.82, bob: 0, eyes: 'squint', arms: 'hug', knot: 'perk', loop: true }),
  verified: state({ eyes: 'happy', arms: 'up', knot: 'perk', sym: 'check', loop: true }),
  broken: state({ sx: 1.03, sy: 0.93, rot: 6, bob: 0.2, eyes: 'x', arms: 'droop', knot: 'droop', sym: 'bang', shake: 1, red: 1, loop: true }),
  guard: state({ sx: 0.96, sy: 1.06, bob: 0.3, eyes: 'wide', arms: 'wide', knot: 'flick', sym: 'bang', jitter: 0.5, loop: true }),
  send: state({ eyes: 'happy', arms: 'up', dur: 950 }),
  success: state({ sx: 1.05, sy: 0.96, bob: 2, eyes: 'happy', arms: 'up', knot: 'perk', sym: 'check', hop: 1, dur: 1500 }),
  failure: state({ sx: 1.04, sy: 0.92, rot: 8, bob: 0.3, eyes: 'sad', arms: 'droop', knot: 'droop', dur: 1700 }),
  warning: state({ sx: 0.93, sy: 1.1, bob: 0.2, eyes: 'wide', arms: 'wide', knot: 'flick', jitter: 1, sym: 'bang', dur: 1600 }),
  inspect: state({ bob: 0.4, eyes: 'squint', scan: 1, arms: 'think', dur: 2000 }),
  blocked: state({ sx: 1.03, sy: 0.97, bob: 0.2, eyes: 'sad', arms: 'block', knot: 'flick', sym: 'stop', shake: 0.5, dur: 1600 }),
  error: state({ bob: 0, eyes: 'x', arms: 'droop', knot: 'droop', sym: 'bang', shake: 1, red: 1, dur: 1500 }),
  surprise: state({ sx: 0.94, sy: 1.1, bob: 0.3, eyes: 'wide', arms: 'wide', knot: 'flick', hop: 0.6, dur: 1200 }),
  wake: state({ eyes: 'round', arms: 'up', knot: 'perk', ew: 1.15, eh: 1.15, dur: 900 }),
  found: state({ sx: 0.96, sy: 1.06, rot: -8, eyes: 'wide', arms: 'point', knot: 'perk', dur: 1500 }),
  happy: state({ sx: 1.06, sy: 0.95, bob: 2, eyes: 'happy', arms: 'up', knot: 'perk', hop: 1, dur: 1300 }),
  wink: state({ rot: 4, eyes: 'wink', arms: 'wave', knot: 'perk', dur: 1100 }),
  wave: state({ eyes: 'happy', arms: 'wave', knot: 'perk', dur: 1600 }),
  confused: state({ rot: -11, bob: 0.6, eyes: 'confused', arms: 'think', sym: 'q', dur: 1800 }),
  ink: state({ sx: 1.08, sy: 0.92, eyes: 'squint', arms: 'open', knot: 'flick', sym: 'ink', dur: 1100 }),
  poke: state({ sx: 0.97, sy: 1.03, rot: -3, eyes: 'squint', knot: 'flick', dur: 520 }),
  bonk: state({ sx: 1.12, sy: 0.84, bob: 0, eyes: 'closed', arms: 'wide', knot: 'perk', dur: 620 }),
  purr: state({ sx: 1.03, sy: 0.98, rot: 3, bob: 0.6, eyes: 'happy', knot: 'droop', sym: 'heart', wiggle: 0.4, dur: 1700 }),
  giggle: state({ sx: 1.04, sy: 0.97, bob: 3, eyes: 'happy', arms: 'open', knot: 'flick', jitter: 1.2, wiggle: 1, dur: 1100 }),
  flip: state({ eyes: 'happy', arms: 'up', knot: 'perk', hop: 1.3, spin: 0.5, dur: 1000 }),
  jump: state({ sx: 0.95, sy: 1.08, eyes: 'wide', arms: 'up', knot: 'perk', hop: 1.9, dur: 1100 }),
  dizzy: state({ eyes: 'x', spin: 1, arms: 'wide', knot: 'flick', dur: 1500 }),
} satisfies Record<string, Cfg>;

export type HachiState = keyof typeof STATES;

// Older names keep working, the way ARC_ALIASES did.
const ALIAS: Record<string, HachiState> = {
  alert: 'guard',
  check: 'inspect',
  think: 'thinking',
  notify: 'found',
  speak: 'talk',
};

export const resolveState = (name: string): HachiState => {
  if (name in STATES) return name as HachiState;
  return ALIAS[name] ?? 'idle';
};

/** One arm is [root x, root y, c1 x, c1 y, c2 x, c2 y, tip x, tip y]. */
type Arm = number[];
const mirror = (a: Arm): Arm => a.map((v, i) => (i % 2 === 0 ? 160 - v : v));

const pose = (outer: Arm, inner: Arm, right?: { inner?: Arm; outer?: Arm }): number[] => [
  ...outer,
  ...inner,
  ...(right?.inner ?? mirror(inner)),
  ...(right?.outer ?? mirror(outer)),
];

// Roots sit low inside the head, clear of the eye cut-outs even at their widest and with the
// eyes looking hard to one side, so an arm can never show through an eye.
const OUTER_ROOT = [44, 100];
const INNER_ROOT = [68, 104];
const REST_OUTER: Arm = [...OUTER_ROOT, 44, 124, 34, 134, 14, 134];
const REST_INNER: Arm = [...INNER_ROOT, 68, 132, 58, 146, 40, 150];

export const ARM_POSES: Record<ArmPose, number[]> = {
  rest: pose(REST_OUTER, REST_INNER),
  up: pose([...OUTER_ROOT, 30, 104, 16, 94, 10, 76], REST_INNER),
  wide: pose([...OUTER_ROOT, 30, 98, 18, 88, 8, 74], [...INNER_ROOT, 62, 124, 54, 138, 46, 152]),
  droop: pose([...OUTER_ROOT, 42, 120, 40, 136, 36, 152], [...INNER_ROOT, 68, 126, 66, 140, 62, 154]),
  open: pose([...OUTER_ROOT, 28, 104, 14, 98, 8, 82], [...INNER_ROOT, 58, 124, 42, 130, 22, 124]),
  think: pose(REST_OUTER, REST_INNER, { outer: [116, 100, 138, 104, 150, 80, 132, 62] }),
  wave: pose(REST_OUTER, REST_INNER, { outer: [116, 100, 132, 100, 146, 86, 148, 58] }),
  hug: pose([...OUTER_ROOT, 38, 118, 50, 130, 66, 128], [...INNER_ROOT, 66, 120, 70, 132, 76, 138]),
  block: pose([...OUTER_ROOT, 54, 126, 82, 136, 108, 124], REST_INNER, { outer: [116, 100, 106, 126, 78, 136, 52, 124] }),
  point: pose(REST_OUTER, REST_INNER, { outer: [116, 100, 130, 94, 144, 80, 156, 62] }),
};

/** The headband's two tails from its knot: [end 1 x, end 1 y, end 2 x, end 2 y]. */
export const KNOT_POSES: Record<KnotPose, number[]> = {
  rest: [152, 32, 150, 66],
  perk: [152, 26, 156, 52],
  flick: [150, 20, 158, 38],
  droop: [146, 74, 136, 80],
};

const circle = (cx: number, cy: number, rx: number, ry: number) => {
  'worklet';
  return `M${(cx - rx).toFixed(2)} ${cy.toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0Z`;
};

const arcEye = (x: number, y: number) => {
  'worklet';
  return `M${x - 12} ${y + 8}A12 12 0 0 1 ${x + 12} ${y + 8}H${x + 5}A5 5 0 0 0 ${x - 5} ${y + 8}Z`;
};

const crossEye = (x: number, y: number) => {
  'worklet';
  const a = 4.2;
  const b = 12;
  return `M${x - b} ${y - b + a}L${x - b + a} ${y - b}L${x} ${y - a}L${x + b - a} ${y - b}L${x + b} ${y - b + a}L${x + a} ${y}L${x + b} ${y + b - a}L${x + b - a} ${y + b}L${x} ${y + a}L${x - b + a} ${y + b}L${x - b} ${y + b - a}L${x - a} ${y}Z`;
};

const barEye = (x: number, y: number, w: number, h: number) => {
  'worklet';
  return `M${(x - w).toFixed(2)} ${(y - h).toFixed(2)}H${(x + w).toFixed(2)}V${(y + h).toFixed(2)}H${(x - w).toFixed(2)}Z`;
};

const LASH_LEN = 8;
const LASH_HALF = 0.16;

const pt = (x: number, y: number) => {
  'worklet';
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
};

/**
 * A round eye with three lashes, all one outline. The head uses even-odd cut-outs, so a lash
 * drawn over the eye would flip back to solid. Going round the edge and out to each tip keeps
 * the whole eye one clean hole, the same see-through eye the band version has.
 */
const lashedEye = (x: number, y: number, rx: number, ry: number, side: number) => {
  'worklet';
  const at = (th: number) => pt(x + side * rx * Math.cos(th), y - ry * Math.sin(th));
  const tip = (th: number) => pt(x + side * (rx + LASH_LEN) * Math.cos(th), y - (ry + LASH_LEN) * Math.sin(th));
  const sweep = side > 0 ? 0 : 1;
  const angles = [20, 44, 68].map((deg) => (deg * Math.PI) / 180);
  const start = angles[0] - LASH_HALF;
  let d = `M${at(start)}`;
  angles.forEach((th, i) => {
    d += `L${tip(th)}L${at(th + LASH_HALF)}`;
    if (i < 2) d += `A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 ${sweep} ${at(angles[i + 1] - LASH_HALF)}`;
  });
  return `${d}A${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 ${sweep} ${at(start)}Z`;
};

/** The happy arc with the same three lashes off its outer edge. */
const lashedArc = (x: number, y: number, side: number) => {
  'worklet';
  const r = 12;
  const cy = y + 8;
  const at = (th: number, k = r) => pt(x + side * k * Math.cos(th), cy - k * Math.sin(th));
  const order = (side > 0 ? [68, 44, 20] : [20, 44, 68]).map((deg) => (deg * Math.PI) / 180);
  let d = `M${x - r} ${cy}`;
  order.forEach((th) => {
    const enter = th + (side > 0 ? LASH_HALF : -LASH_HALF);
    const exit = th + (side > 0 ? -LASH_HALF : LASH_HALF);
    d += `A${r} ${r} 0 0 1 ${at(enter)}L${at(th, r + LASH_LEN)}L${at(exit)}`;
  });
  return `${d}A${r} ${r} 0 0 1 ${x + r} ${cy}H${x + 5}A5 5 0 0 0 ${x - 5} ${cy}Z`;
};

/** A flat top edge, left to right, with lashes along its outer end. */
const lashedTop = (x: number, y: number, w: number, side: number) => {
  'worklet';
  const spots = side > 0 ? [0.1, 0.45, 0.8] : [-0.8, -0.45, -0.1];
  let d = '';
  spots.forEach((f) => {
    const b = x + w * f;
    d += `L${pt(b - 1.8, y)}L${pt(b + side * 3, y - 6.5)}L${pt(b + 1.8, y)}`;
  });
  return `${d}L${pt(x + w, y)}`;
};

export type EyeInput = {
  mode: EyeMode;
  lx: number;
  ly: number;
  ew: number;
  eh: number;
  blink: number;
  bow: boolean;
  micro: boolean;
};

/** The eye holes, as sub-paths cut out of the head. The bow adds lashes and changes nothing else. */
export const eyesPath = ({ mode, lx, ly, ew, eh, blink, bow, micro }: EyeInput) => {
  'worklet';
  const nx = Math.max(-1, Math.min(1, lx / 14));
  const cx = 80;
  const y0 = 78 + ly;
  const base = 10.5 * (micro ? 1.25 : 1);
  const lash = bow && !micro;
  let d = '';
  [60, 100].forEach((x0, i) => {
    const off = x0 - cx;
    const sd = Math.sign(off);
    const x = cx + off * (1 - 0.2 * Math.abs(nx)) + lx;
    const squash = 1 - 0.32 * Math.max(0, nx * sd) - 0.06 * Math.abs(nx);
    const rx = base * ew * squash;
    const ry = Math.max(1.2, base * eh * (1 - blink * 0.92));
    const round = (ex: number, ey: number, erx: number, ery: number) => (lash ? lashedEye(ex, ey, erx, ery, sd) : circle(ex, ey, erx, ery));
    const arc = () => (lash ? lashedArc(x, y0, sd) : arcEye(x, y0));
    const bar = (w: number, h: number, y: number) =>
      lash ? `M${pt(x - w, y - h)}${lashedTop(x, y - h, w, sd)}V${(y + h).toFixed(2)}H${(x - w).toFixed(2)}Z` : barEye(x, y, w, h);
    if (mode === 'happy') d += arc();
    else if (mode === 'closed') d += bar(12, 2.6, y0 + 2);
    else if (mode === 'x') d += crossEye(x, y0);
    else if (mode === 'squint') d += bar(12, 3.4, y0);
    else if (mode === 'wink' && i === 0) d += arc();
    else if (mode === 'lid') {
      const top = y0 + 1;
      d += `M${pt(x - rx, top)}${lash ? lashedTop(x, top, rx, sd) : `H${(x + rx).toFixed(2)}`}A${rx.toFixed(2)} ${(ry * 0.8).toFixed(2)} 0 0 1 ${pt(x - rx, top)}Z`;
    } else if (mode === 'sad') d += round(x, y0 + 3, rx * 0.9, ry * 0.85);
    else if (mode === 'confused') d += round(x, y0 + (i ? -2 : 3), rx * (i ? 1.15 : 0.7), ry * (i ? 1.1 : 0.6));
    else if (mode === 'wide') d += round(x, y0, rx * 1.4, ry * 1.4) + circle(x, y0, rx * 0.48, Math.max(1, ry * 0.48));
    else d += round(x, y0, rx, ry);
  });
  return d;
};

export const HEAD_BAND = 'M35 36A45 32 0 0 1 125 36ZM35 58H125V90C125 104 106 112 80 112C54 112 35 104 35 90Z';
export const HEAD_PLAIN = 'M35 52A45 38 0 0 1 125 52V90C125 104 106 112 80 112C54 112 35 104 35 90Z';
export const PARTY_HAT = 'M56 12L80 -18L104 12C96 7 64 7 56 12Z';

/** A symbol at Hachi's upper left, clear of the knot and the bow, as one stroked path. */
export const symPath = (sym: Sym, t: number, stateT: number) => {
  'worklet';
  if (sym === 'dots') {
    let d = '';
    for (let i = 0; i < 3; i++) {
      const y = 20 - i * 7 + Math.sin(t * 5 - i) * 2;
      const x = 22 - i * 11;
      d += `M${x} ${y.toFixed(2)}h0.1`;
    }
    return d;
  }
  if (sym === 'zz') {
    const k = (t * 0.55) % 1;
    const s = 8 + k * 6;
    const x = 12 - k * 12;
    const y = 22 - k * 20;
    return `M${x.toFixed(2)} ${y.toFixed(2)}h${s.toFixed(2)}l${(-s).toFixed(2)} ${s.toFixed(2)}h${s.toFixed(2)}`;
  }
  if (sym === 'check') {
    const k = Math.min(1, stateT * 3);
    const x1 = 2 + 10 * Math.min(1, k * 2);
    const y1 = 18 + 10 * Math.min(1, k * 2);
    const k2 = Math.max(0, k * 2 - 1);
    return `M2 18L${x1.toFixed(2)} ${y1.toFixed(2)}L${(12 + 16 * k2).toFixed(2)} ${(28 - 22 * k2).toFixed(2)}`;
  }
  if (sym === 'heart') {
    const k = (t * 0.6) % 1;
    const x = 14 - k * 8;
    const y = 22 - k * 22;
    const h = 7 + k * 3;
    return `M${(x - h * 0.55).toFixed(2)} ${(y - h * 0.3).toFixed(2)}L${x.toFixed(2)} ${(y + h * 0.55).toFixed(2)}L${(x + h * 0.55).toFixed(2)} ${(y - h * 0.3).toFixed(2)}`;
  }
  if (sym === 'ink') {
    const k = Math.min(1, stateT * 1.5);
    if (k >= 1) return '';
    let d = '';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 52 + k * 56;
      d += `M${(80 + Math.cos(a) * r).toFixed(2)} ${(78 + Math.sin(a) * r).toFixed(2)}h0.1`;
    }
    return d;
  }
  if (sym === 'bang') return 'M14 -2V18M14 30h0.1';
  if (sym === 'q') return 'M2 6C2 -6 22 -6 22 6C22 14 12 14 12 22M12 34h0.1';
  if (sym === 'stop') return 'M4 0L24 20M24 0L4 20';
  return '';
};

const GLYPHS: Record<string, string> = {
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100110010001000011111',
  '3': '11110000010000101110000010000111110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  a: '00000000000111000001011111000101111',
  b: '10000100001011011001100011000111110',
  c: '00000000000111010000100001000101110',
  d: '00001000010110110011100011000101111',
  e: '00000000000111010001111111000001110',
  f: '00110010010100011100010000100001000',
  x: '00000000001000101010001000101010001',
};

/** The commit hash in the band, drawn as pixels so there is no font to load. */
export const hashPath = (hash: string) => {
  let d = '';
  hash
    .slice(0, 6)
    .toLowerCase()
    .split('')
    .forEach((ch, c) => {
      const glyph = GLYPHS[ch] ?? GLYPHS.x;
      for (let i = 0; i < 35; i++) {
        if (glyph[i] !== '1') continue;
        d += `M${45 + c * 12 + (i % 5) * 2} ${40 + Math.floor(i / 5) * 2}h2v2h-2Z`;
      }
    });
  return d;
};

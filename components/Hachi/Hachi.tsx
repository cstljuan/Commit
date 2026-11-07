import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { hachi, onAnyTouch, pointer } from '@/lib/hachi';
import { sfx } from '@/lib/sound';
import * as Haptics from '@/lib/haptics';
import { useMotionOff, usePrefs } from '@/lib/prefs';
import { useMode } from '@/lib/theme';

import {
  ARM_POSES,
  HEAD_BAND,
  HEAD_PLAIN,
  KNOT_POSES,
  PARTY_HAT,
  STATES,
  eyesPath,
  hashPath,
  resolveState,
  symPath,
  type Cfg,
  type HachiState,
} from './model';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export type { HachiState };
export type Accessory = 'band' | 'bow' | 'party' | 'none';
export type HachiGesture = 'tap' | 'double' | 'hold' | 'overhold' | 'drag' | 'arm' | 'tug' | 'pet' | 'tickle' | 'fling' | 'poke' | 'bonk' | 'dizzy';

export type HachiHandle = {
  /** One-shot reaction, resolved when it ends. Returns to the held state, like Arc. */
  play: (name: HachiState) => Promise<void>;
  /** Holds a looping state until changed. */
  set: (name: HachiState) => void;
  reset: () => void;
  /** Drives the talk pulse from a level between 0 and 1. Pass null to let it pulse alone. */
  setLevel: (level: number | null) => void;
  /** Turns to face left or right, with an animated turn. */
  face: (dir: 'left' | 'right') => void;
  flip: () => void;
};

type Props = {
  /** Holds this state. Leave out and use the ref or the `hachi` bus instead. */
  state?: HachiState | string;
  size?: number;
  /** Overrides the mode color, for example on a colored background. */
  color?: string;
  /** Runs the live engine. Off draws one still frame, for long lists. */
  animated?: boolean;
  /** Every gesture: tap, hold, drag, grab an arm, tug the bow or knot, pet, tickle, fling. On by default. */
  interactive?: boolean;
  /** Reacts to `hachi.play()` from anywhere in the app. */
  listen?: boolean;
  /** Eyes follow the finger. */
  follow?: boolean;
  /** Dozes off after this many ms without a touch. 0 never sleeps. */
  sleepAfter?: number;
  accessory?: Accessory;
  /** The hash on the headband. */
  hash?: string;
  onGesture?: (g: HachiGesture) => void;
};

const ARM_K = 150;
const ARM_C = 15;
const MICRO_BELOW = 48;
const BOW_CENTER = { x: 106, y: 20 };
const ACCESSORY = 4;
const ZONE = { body: 0, eye: 1, top: 2, arm: 3, accessory: 4 };
const NO_PRESS = { active: false, moved: false, arm: -1, zone: 0, dx: 0, dy: 0, tx: 0, ty: 0, vx: 0, vy: 0, sign: 0, travel: 0, revs: 0, revAt: 0, speed: 0, lastX: 0, lastY: 0 };

const stepSpring = (x: number, v: number, target: number, k: number, c: number, dt: number) => {
  'worklet';
  const nv = v + (k * (target - x) - c * v) * dt;
  return [x + nv * dt, nv];
};

const soft = (v: number, lim: number) => {
  'worklet';
  return lim * Math.tanh(v / lim);
};

const armPath = (p: number[], i: number) => {
  'worklet';
  const o = i * 8;
  return `M${p[o].toFixed(2)} ${p[o + 1].toFixed(2)}C${p[o + 2].toFixed(2)} ${p[o + 3].toFixed(2)} ${p[o + 4].toFixed(2)} ${p[o + 5].toFixed(2)} ${p[o + 6].toFixed(2)} ${p[o + 7].toFixed(2)}`;
};

const bowPath = (flap: number, ox: number, oy: number) => {
  'worklet';
  const x = BOW_CENTER.x + ox;
  const y = BOW_CENTER.y + oy;
  const f = flap * 6;
  return (
    `M${x} ${y}C${x - 12} ${y - 19 - f} ${x - 34} ${y - 16 - f} ${x - 32} ${y + 2}C${x - 34} ${y + 19 + f * 0.5} ${x - 12} ${y + 19 + f * 0.5} ${x} ${y}Z` +
    `M${x} ${y}C${x + 12} ${y + 19 + f * 0.5} ${x + 34} ${y + 19 + f * 0.5} ${x + 32} ${y + 2}C${x + 34} ${y - 16 - f} ${x + 12} ${y - 19 - f} ${x} ${y}Z` +
    `M${x + 7.5} ${y}a7.5 7.5 0 1 0 -15 0a7.5 7.5 0 1 0 15 0Z`
  );
};

/**
 * Hachi. The same idea as Seams' arc-mascot: named states, spring physics, and gestures, with
 * the drawing computed fresh each frame on the UI thread.
 */
export const Hachi = forwardRef<HachiHandle, Props>(function Hachi(
  {
    state,
    size = 96,
    color,
    animated = false,
    interactive = true,
    listen = false,
    follow = true,
    sleepAfter = 60000,
    accessory,
    hash = 'a3f19c',
    onGesture,
  },
  ref,
) {
  const { t, mode } = useMode();
  const { prefs } = usePrefs();
  const motionOff = useMotionOff();
  const micro = size < MICRO_BELOW;
  const worn: Accessory = accessory ?? (prefs.hachiAccessory === 'auto' ? (mode === 'women' ? 'bow' : 'band') : prefs.hachiAccessory);
  const hasBow = worn === 'bow';
  const hasBand = worn === 'band';
  const armWidth = micro ? 19 : 15;
  const picked = prefs.hachiColor && prefs.hachiColor !== 'auto' ? prefs.hachiColor : undefined;
  const fill = color ?? picked ?? t.primary;
  const live = animated && !motionOff;
  // The bow is gold on pink and pink on everything else, so it always stands out.
  const bowFill = fill.toUpperCase() === '#E4688C' || (mode === 'women' && !color && !picked) ? '#FFC233' : '#E4688C';

  const cfg = useSharedValue<Cfg>(STATES[resolveState(state ?? 'idle')]);
  const stateClock = useSharedValue(0);
  const levelSV = useSharedValue(-1);
  const facing = useSharedValue(1);
  const center = useSharedValue({ x: -1, y: -1 });
  const reduce = useSharedValue(motionOff ? 1 : 0);
  const press = useSharedValue(NO_PRESS);

  const initial = STATES[resolveState(state ?? 'idle')];
  const sim = useSharedValue({
    time: 0,
    blinkAt: 1.5,
    blink: 0,
    arms: [...ARM_POSES[initial.arms]],
    armsV: new Array(32).fill(0) as number[],
    knot: [...KNOT_POSES[initial.knot]],
    knotV: [0, 0, 0, 0],
    bx: 0,
    bxV: 0,
    by: 0,
    byV: 0,
    flap: 0,
    flapV: 0,
    sx: initial.sx,
    sxV: 0,
    sy: initial.sy,
    syV: 0,
    rot: initial.rot,
    rotV: 0,
    bob: initial.bob,
    bobV: 0,
    ew: initial.ew,
    ewV: 0,
    eh: initial.eh,
    ehV: 0,
    lx: 0,
    lxV: 0,
    ly: 0,
    lyV: 0,
    hop: 0,
    hopV: 0,
    dx: 0,
    dxV: 0,
    dy: 0,
    dyV: 0,
    fl: 1,
    flV: 0,
    tilt: 0,
    tiltV: 0,
    spin: 0,
    red: initial.red,
    lastCfg: initial as Cfg | null,
  });

  const paintStill = useCallback(
    (c: Cfg) => {
      const arms = ARM_POSES[c.arms];
      const k = KNOT_POSES[c.knot];
      return {
        arm0: armPath(arms, 0),
        arm1: armPath(arms, 1),
        arm2: armPath(arms, 2),
        arm3: armPath(arms, 3),
        knot: `M126 47L${k[0]} ${k[1]}M126 47L${k[2]} ${k[3]}`,
        eyes: eyesPath({ mode: c.eyes, lx: 0, ly: 0, ew: c.ew, eh: c.eh, blink: 0, bow: hasBow, micro }),
        bow: bowPath(0, 0, 0),
        sym: symPath(c.sym, 0, 1),
        tx: 0,
        ty: 0,
        rot: c.rot,
        sx: c.sx,
        sy: c.sy,
        red: c.red,
      };
    },
    [hasBow, micro],
  );

  const out = useSharedValue(paintStill(initial));

  // A still Hachi repaints whenever its state or look changes.
  useEffect(() => {
    if (live) return;
    out.value = paintStill(STATES[resolveState(state ?? 'idle')]);
  }, [live, out, paintStill, state]);

  const frame = useFrameCallback((info) => {
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const s = sim.value;
    const c = cfg.value;
    const p = press.value;
    s.time += dt;
    stateClock.value += dt;
    const sT = stateClock.value;
    const m = reduce.value ? 0.25 : 1;

    if (s.lastCfg !== c) {
      if (c.hop) s.hopV = -170 * c.hop;
      if (c.spin) s.spin = 0;
      s.lastCfg = c;
    }

    // Where the eyes look: the state's own direction, a scan, or the last touch.
    let lookX = 0;
    let lookY = 0;
    let tiltT = 0;
    if (p.active && p.moved) {
      const n = Math.hypot(s.dx, s.dy) || 1;
      lookX = (s.dx / n) * 12;
      lookY = (s.dy / n) * 8;
    } else if (c.scan) {
      lookX = Math.sin(s.time * 2.4) * 11;
      lookY = 2;
    } else if (c.look) {
      lookX = c.look[0];
      lookY = c.look[1];
    } else {
      const ptr = pointer.value;
      const fresh = ptr.t > 0 && info.timestamp - ptr.t < 1600;
      if (follow && fresh && center.value.x >= 0) {
        const ddx = ptr.x - center.value.x;
        const ddy = ptr.y - center.value.y;
        const dist = Math.hypot(ddx, ddy) || 1;
        const k = Math.min(1, dist / 240);
        lookX = (ddx / dist) * k * 12;
        lookY = (ddy / dist) * k * 8;
        tiltT = (ddx / dist) * k * 6;
      }
    }

    let r = stepSpring(s.lx, s.lxV, lookX * facing.value, 140, 15, dt);
    s.lx = r[0];
    s.lxV = r[1];
    r = stepSpring(s.ly, s.lyV, lookY, 140, 15, dt);
    s.ly = r[0];
    s.lyV = r[1];
    r = stepSpring(s.tilt, s.tiltV, tiltT, 90, 13, dt);
    s.tilt = r[0];
    s.tiltV = r[1];
    r = stepSpring(s.sx, s.sxV, c.sx, 180, 16, dt);
    s.sx = r[0];
    s.sxV = r[1];
    r = stepSpring(s.sy, s.syV, c.sy, 180, 16, dt);
    s.sy = r[0];
    s.syV = r[1];
    r = stepSpring(s.rot, s.rotV, c.rot * facing.value, 180, 16, dt);
    s.rot = r[0];
    s.rotV = r[1];
    r = stepSpring(s.bob, s.bobV, c.bob, 180, 16, dt);
    s.bob = r[0];
    s.bobV = r[1];
    r = stepSpring(s.ew, s.ewV, c.ew, 200, 16, dt);
    s.ew = r[0];
    s.ewV = r[1];
    r = stepSpring(s.eh, s.ehV, c.eh, 200, 16, dt);
    s.eh = r[0];
    s.ehV = r[1];
    r = stepSpring(s.hop, s.hopV, 0, 260, 14, dt);
    s.hop = r[0];
    s.hopV = r[1];
    r = stepSpring(s.dx, s.dxV, p.active && p.arm < 0 ? p.dx : 0, 220, 10, dt);
    s.dx = r[0];
    s.dxV = r[1];
    r = stepSpring(s.dy, s.dyV, p.active && p.arm < 0 ? p.dy : 0, 220, 10, dt);
    s.dy = r[0];
    s.dyV = r[1];
    r = stepSpring(s.fl, s.flV, facing.value, 150, 16, dt);
    s.fl = r[0];
    s.flV = r[1];
    s.red += (c.red - s.red) * Math.min(1, dt * 10);

    // Arms: every coordinate springs to its pose. Roots stay inside the head, tips swing free,
    // so the limb stays one unbroken stroke in every frame.
    const target = ARM_POSES[c.arms];
    const sway = c.wiggle ? 3.4 * c.wiggle : c.arms === 'rest' ? 1 : 0.4;
    for (let i = 0; i < 32; i++) {
      let tt = target[i];
      const arm = Math.floor(i / 8);
      const part = i % 8;
      if (part >= 2) {
        // Idle life: tips sway in a wave along the arm, and they trail the body when dragged.
        const reach = part / 7;
        const phase = s.time * (c.wiggle ? 14 : 1.8) + arm * 1.2;
        if (part % 2 === 0) {
          tt += Math.sin(phase) * 2.6 * reach * sway * m;
          tt -= s.dx * 0.32 * reach;
        } else {
          tt += Math.cos(phase * 0.9) * 1.6 * reach * sway * m;
          tt -= s.dy * 0.26 * reach;
        }
      }
      if (c.arms === 'wave' && arm === 3 && part >= 4) {
        const w = Math.sin(s.time * 11) * 9 * (part / 7);
        if (part % 2 === 0) tt += w;
      }
      if (p.active && p.arm === arm && part >= 4) {
        const pull = part === 6 || part === 7 ? 1 : 0.55;
        tt += (part % 2 === 0 ? p.tx : p.ty) * pull;
      }
      r = stepSpring(s.arms[i], s.armsV[i], tt, p.active && p.arm === arm ? 320 : ARM_K, p.active && p.arm === arm ? 20 : ARM_C, dt);
      s.arms[i] = r[0];
      s.armsV[i] = r[1];
    }

    const knotT = KNOT_POSES[c.knot];
    for (let i = 0; i < 4; i++) {
      const flutter = Math.sin(s.time * 3 + i) * 1.4 * m;
      const tug = p.active && p.arm === ACCESSORY ? (i % 2 === 0 ? p.tx : p.ty) : 0;
      r = stepSpring(s.knot[i], s.knotV[i], knotT[i] + flutter + tug - (i % 2 === 0 ? s.dx * 0.5 : s.dy * 0.4), 170, 11, dt);
      s.knot[i] = r[0];
      s.knotV[i] = r[1];
    }

    // The bow can be tugged off its spot and wobbles back. Tapping it makes the wings flap.
    const tugging = p.active && p.arm === ACCESSORY;
    r = stepSpring(s.bx, s.bxV, tugging ? soft(p.tx * 0.45, 16) : -s.dx * 0.12, 190, 9, dt);
    s.bx = r[0];
    s.bxV = r[1];
    r = stepSpring(s.by, s.byV, tugging ? soft(p.ty * 0.45, 12) : -s.dy * 0.12, 190, 9, dt);
    s.by = r[0];
    s.byV = r[1];
    r = stepSpring(s.flap, s.flapV, 0, 240, 8, dt);
    s.flap = r[0];
    s.flapV = r[1];

    // Blink.
    if (s.time > s.blinkAt) {
      s.blink = 1;
      s.blinkAt = s.time + 2 + Math.random() * 3.5;
    }
    s.blink = Math.max(0, s.blink - dt * 7);
    const blink = c.eyes === 'round' || c.eyes === 'wide' ? Math.sin(Math.min(1, s.blink) * Math.PI) : 0;

    // Whole body.
    let tx = s.dx;
    let ty = Math.sin(s.time * 2.2) * 3.2 * s.bob * m + s.hop * 0.13 + s.dy;
    if (c.jitter) {
      tx += (Math.random() - 0.5) * 2.4 * c.jitter;
      ty += (Math.random() - 0.5) * 1.6 * c.jitter;
    }
    if (c.shake) tx += Math.sin(sT * 40) * 6 * c.shake * Math.max(0, 1 - sT * 1.2);
    if (c.spin) s.spin = Math.min(1, s.spin + dt / 0.9);
    const spinEase = c.spin ? (1 - Math.pow(1 - s.spin, 3)) * 720 * c.spin : 0;
    const level = levelSV.value;
    const amp = c.pulse ? (level >= 0 ? level : (Math.sin(s.time * 10) + 1) / 2) : 0;
    const pulse = reduce.value ? 1 : 1 + amp * 0.1;
    const drag = Math.hypot(s.dx, s.dy);
    // The longer the squeeze, the flatter Hachi gets.
    const squish = c.arms === 'hug' ? Math.min(0.14, sT * 0.07) : 0;
    const sx = s.sx * pulse * (1 + Math.abs(s.dx) / 260) * (1 + squish);
    const sy = s.sy * pulse * (1 + Math.abs(s.dy) / 260 - drag / 900) * (1 - squish);

    out.value = {
      arm0: armPath(s.arms, 0),
      arm1: armPath(s.arms, 1),
      arm2: armPath(s.arms, 2),
      arm3: armPath(s.arms, 3),
      knot: `M126 47L${s.knot[0].toFixed(2)} ${s.knot[1].toFixed(2)}M126 47L${s.knot[2].toFixed(2)} ${s.knot[3].toFixed(2)}`,
      eyes: eyesPath({ mode: c.eyes, lx: s.lx, ly: s.ly, ew: s.ew, eh: s.eh, blink, bow: hasBow, micro }),
      bow: bowPath(Math.max(0, Math.sin(s.time * 2.4)) * 0.5 + Math.abs(s.hopV) / 200 + s.flap, s.bx, s.by),
      sym: symPath(c.sym, s.time, sT),
      tx: (tx * size) / 160,
      ty: (ty * size) / 160,
      rot: s.rot + s.tilt + spinEase,
      sx: sx * Math.max(0.04, Math.abs(s.fl)) * (s.fl < 0 ? -1 : 1),
      sy,
      red: s.red,
    };
  }, live);

  useEffect(() => {
    frame.setActive(live);
    reduce.value = motionOff ? 1 : 0;
  }, [frame, live, motionOff, reduce]);

  // The state machine, the same as Arc's: looping states hold, one-shots return to them.
  const base = useRef<HachiState>(resolveState(state ?? 'idle'));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTouch = useRef(Date.now());

  const go = useCallback(
    (name: HachiState) => {
      cfg.value = STATES[name];
      stateClock.value = 0;
    },
    [cfg, stateClock],
  );

  const set = useCallback(
    (raw: HachiState | string) => {
      const name = resolveState(raw);
      if (!STATES[name].loop) {
        // A one-shot asked to hold simply plays.
        clearTimeout(timer.current);
        go(name);
        timer.current = setTimeout(() => go(base.current), STATES[name].dur);
        return;
      }
      clearTimeout(timer.current);
      base.current = name;
      go(name);
    },
    [go],
  );

  const play = useCallback(
    (raw: HachiState | string) =>
      new Promise<void>((resolve) => {
        const name = resolveState(raw);
        if (STATES[name].loop) {
          set(name);
          resolve();
          return;
        }
        clearTimeout(timer.current);
        go(name);
        timer.current = setTimeout(() => {
          go(base.current);
          resolve();
        }, STATES[name].dur);
      }),
    [go, set],
  );

  const flip = useCallback(() => {
    facing.value = facing.value > 0 ? -1 : 1;
  }, [facing]);

  useImperativeHandle(
    ref,
    () => ({
      play,
      set,
      reset: () => {
        clearTimeout(timer.current);
        base.current = 'idle';
        go('idle');
      },
      setLevel: (level) => {
        levelSV.value = level == null ? -1 : Math.max(0, Math.min(1, level));
      },
      face: (dir) => {
        facing.value = dir === 'left' ? -1 : 1;
      },
      flip,
    }),
    [facing, flip, go, levelSV, play, set],
  );

  useEffect(() => {
    if (state) set(state);
  }, [set, state]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!listen) return;
    return hachi.subscribe(({ type, name }) => {
      if (type === 'play') play(name);
      else set(name);
    });
  }, [listen, play, set]);

  // Dozes off after a minute with no touch, wakes on the next one.
  useEffect(() => {
    if (!live || !sleepAfter || state) return;
    const off = onAnyTouch(() => {
      lastTouch.current = Date.now();
      if (base.current === 'sleep' || base.current === 'bored') {
        base.current = 'idle';
        play('wake');
      }
    });
    const check = setInterval(() => {
      const quiet = Date.now() - lastTouch.current;
      if (base.current === 'idle' && quiet > sleepAfter * 0.5) set('bored');
      if (base.current === 'bored' && quiet > sleepAfter) set('sleep');
    }, 4000);
    return () => {
      off();
      clearInterval(check);
    };
  }, [live, play, set, sleepAfter, state]);

  // Gestures. Arc's tap, hold, drag and arm grab, plus where you touch and how you move:
  // poke an eye, bonk the head, tug the bow or knot, pet, tickle, fling, or squeeze too long.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holding = useRef(false);
  const heldAt = useRef(0);
  const rubbed = useRef(false);
  const tapsAt = useRef<number[]>([]);
  const prevBase = useRef<HachiState>('idle');

  const clearHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    clearTimeout(inkTimer.current);
  }, []);

  const pressStart = useCallback(() => {
    holding.current = false;
    rubbed.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => {
      holding.current = true;
      heldAt.current = Date.now();
      prevBase.current = base.current;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sfx('h_squeeze');
      set('squeeze');
      onGesture?.('hold');
      // Octopuses ink when squeezed for too long.
      inkTimer.current = setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        sfx('ink');
        play('ink');
        onGesture?.('overhold');
      }, 2200);
    }, 380);
  }, [clearHold, onGesture, play, set]);

  const pressMoved = useCallback(
    (grabbed: number) => {
      clearHold();
      Haptics.selectionAsync();
      onGesture?.(grabbed === ACCESSORY ? 'tug' : grabbed >= 0 ? 'arm' : 'drag');
    },
    [clearHold, onGesture],
  );

  const rub = useCallback(
    (fast: boolean) => {
      rubbed.current = true;
      if (fast) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.selectionAsync();
      sfx(fast ? 'h_giggle' : 'h_purr');
      play(fast ? 'giggle' : 'purr');
      onGesture?.(fast ? 'tickle' : 'pet');
    },
    [onGesture, play],
  );

  const pressEnd = useCallback(
    (moved: boolean, big: boolean, zone: number, flingX: number, flingY: number) => {
      clearHold();
      if (holding.current) {
        holding.current = false;
        base.current = prevBase.current;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const long = Date.now() - heldAt.current > 1200;
        sfx(long ? 'h_jump' : 'h_happy');
        play(long ? 'jump' : 'happy');
        return;
      }
      if (rubbed.current) return;
      if (moved) {
        const speed = Math.hypot(flingX, flingY);
        if (speed > 900) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          sfx(flingY < -600 ? 'h_jump' : speed > 2400 ? 'h_dizzy' : 'h_poke');
          play(flingY < -600 ? 'jump' : speed > 2400 ? 'dizzy' : 'surprise');
          onGesture?.('fling');
        } else if (zone === ZONE.accessory) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          sfx('h_wink');
          play('wink');
        } else if (big) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          sfx('h_poke');
          play('surprise');
        }
        return;
      }
      const now = Date.now();
      const quick = now - (tapsAt.current[tapsAt.current.length - 1] ?? 0) < 300;
      tapsAt.current = [...tapsAt.current.filter((x) => now - x < 2000), now];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (tapsAt.current.length >= 5) {
        tapsAt.current = [];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        sfx('h_dizzy');
        play('dizzy');
        onGesture?.('dizzy');
      } else if (quick) {
        sfx('h_flip');
        play('flip');
        onGesture?.('double');
      } else if (zone === ZONE.eye) {
        sfx('h_poke');
        play('poke');
        onGesture?.('poke');
      } else if (zone === ZONE.top) {
        sfx('h_bonk');
        play('bonk');
        onGesture?.('bonk');
      } else if (zone === ZONE.accessory) {
        sfx('h_wink');
        play('wink');
        onGesture?.('tug');
      } else {
        sfx(tapsAt.current.length % 2 ? 'h_happy' : 'h_wink');
        play(tapsAt.current.length % 2 ? 'happy' : 'wink');
        onGesture?.('tap');
      }
    },
    [clearHold, onGesture, play],
  );

  useEffect(() => clearHold, [clearHold]);

  // Hachi hops when you switch modes.
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    if (live) play('happy');
  }, [live, mode, play]);

  const toUnits = 160 / size;
  const pan = usePanGesture({
    enabled: interactive && live,
    minDistance: 0,
    hitSlop: size < 60 ? 12 : 0,
    onBegin: (e) => {
      'worklet';
      const ux = e.x * toUnits;
      const uy = e.y * toUnits;
      const s = sim.value;
      let arm = -1;
      let best = 30;
      for (let i = 0; i < 4; i++) {
        const dist = Math.hypot(s.arms[i * 8 + 6] - ux, s.arms[i * 8 + 7] - uy);
        if (dist < best) {
          best = dist;
          arm = i;
        }
      }
      let zone = arm >= 0 ? ZONE.arm : ZONE.body;
      if (arm < 0) {
        const onBow = hasBow && Math.abs(ux - BOW_CENTER.x) < 38 && Math.abs(uy - BOW_CENTER.y) < 24;
        const onKnot = hasBand && ux > 122 && uy > 18 && uy < 80;
        if (onBow || onKnot) {
          arm = ACCESSORY;
          zone = ZONE.accessory;
        } else if (Math.abs(uy - 78) < 17 && (Math.abs(ux - 60) < 17 || Math.abs(ux - 100) < 17)) {
          zone = ZONE.eye;
        } else if (uy < 42) {
          zone = ZONE.top;
        }
      }
      press.value = { ...NO_PRESS, active: true, arm, zone };
      scheduleOnRN(pressStart);
    },
    onUpdate: (e) => {
      'worklet';
      const p = press.value;
      const ux = e.translationX * toUnits;
      const uy = e.translationY * toUnits;
      const moved = p.moved || Math.hypot(e.translationX, e.translationY) > 6;
      if (moved && !p.moved) scheduleOnRN(pressMoved, p.arm);

      // Back and forth is a rub: fast is a tickle, slow is petting.
      const v = Math.abs(e.velocityX) > Math.abs(e.velocityY) ? e.velocityX : e.velocityY;
      const sign = Math.abs(v) > 40 ? Math.sign(v) : p.sign;
      let revs = p.revs;
      let revAt = p.revAt;
      let speed = p.speed;
      let travel = p.travel + Math.hypot(e.translationX - p.lastX, e.translationY - p.lastY);
      const now = Date.now();
      if (p.sign !== 0 && sign !== p.sign && travel > 10) {
        revs = now - revAt < 1100 ? revs + 1 : 1;
        revAt = now;
        travel = 0;
      }
      speed += (Math.abs(v) - speed) * 0.2;
      const fast = speed > 420;
      if ((revs >= 3 || (revs >= 2 && !fast)) && p.arm !== ACCESSORY && p.zone !== ZONE.arm) {
        scheduleOnRN(rub, fast);
        revs = 0;
      }

      press.value = {
        ...p,
        moved,
        sign,
        revs,
        revAt,
        speed,
        travel,
        lastX: e.translationX,
        lastY: e.translationY,
        vx: e.velocityX,
        vy: e.velocityY,
        dx: moved && p.arm < 0 ? soft(ux * 0.55, 46) : 0,
        dy: moved && p.arm < 0 ? soft(uy * 0.55, 46) : 0,
        tx: moved && p.arm >= 0 ? soft(ux, 42) : 0,
        ty: moved && p.arm >= 0 ? soft(uy, 42) : 0,
      };
    },
    onFinalize: () => {
      'worklet';
      const p = press.value;
      const s = sim.value;
      const big = Math.hypot(p.dx, p.dy) > 22 || Math.hypot(p.tx, p.ty) > 18;
      if (p.moved) {
        // Whatever was thrown keeps its speed, so it overshoots and wobbles home.
        s.dxV += p.arm < 0 ? p.vx * toUnits * 0.3 : 0;
        s.dyV += p.arm < 0 ? p.vy * toUnits * 0.3 : 0;
      } else if (p.arm >= 0 && p.arm < ACCESSORY) {
        // A tapped arm flicks.
        const dir = p.arm < 2 ? -1 : 1;
        s.armsV[p.arm * 8 + 6] += 320 * dir;
        s.armsV[p.arm * 8 + 7] -= 300;
        s.armsV[p.arm * 8 + 4] += 150 * dir;
      } else if (p.arm === ACCESSORY) {
        s.flapV += 26;
        s.knotV[0] += 260;
        s.knotV[1] -= 200;
        s.knotV[2] += 260;
        s.knotV[3] += 200;
      }
      press.value = NO_PRESS;
      scheduleOnRN(pressEnd, p.moved, big, p.zone, p.vx, p.vy);
    },
  });

  // The whole figure lives in a larger canvas so arms never clip when pulled or spun.
  const canvas = size * 1.5;
  const pad = size * 0.25;

  const body = useAnimatedStyle(() => {
    const o = out.value;
    return {
      transform: [{ translateX: o.tx }, { translateY: o.ty }, { rotate: `${o.rot}deg` }, { scaleX: o.sx }, { scaleY: o.sy }],
    };
  });

  const paint = useMemo(() => (hasBand && !micro && size >= 72 ? hashPath(hash) : ''), [hasBand, hash, micro, size]);
  const head = hasBand ? HEAD_BAND : HEAD_PLAIN;

  const redFill = '#B3261E';
  const arm0 = useAnimatedProps(() => ({ d: out.value.arm0 }));
  const arm1 = useAnimatedProps(() => ({ d: out.value.arm1 }));
  const arm2 = useAnimatedProps(() => ({ d: out.value.arm2 }));
  const arm3 = useAnimatedProps(() => ({ d: out.value.arm3 }));
  const knot = useAnimatedProps(() => ({ d: out.value.knot }));
  const face = useAnimatedProps(() => ({ d: head + out.value.eyes }));
  const bow = useAnimatedProps(() => ({ d: out.value.bow }));
  const sym = useAnimatedProps(() => ({ d: out.value.sym }));
  const redLayer = useAnimatedProps(() => ({ opacity: out.value.red }));
  const normalLayer = useAnimatedProps(() => ({ opacity: 1 - out.value.red }));

  const figure = (ink: string, layerProps: typeof redLayer) => (
    <AnimatedPathGroup
      ink={ink}
      layerProps={layerProps}
      armWidth={armWidth}
      arms={[arm0, arm1, arm2, arm3]}
      knot={hasBand ? knot : null}
      face={face}
      hash={paint}
    />
  );

  const drawing = (
    <Animated.View style={[{ width: canvas, height: canvas, margin: -pad }, body]}>
      <Svg width={canvas} height={canvas} viewBox="-40 -40 240 240" fill="none">
        {figure(fill, normalLayer)}
        {figure(redFill, redLayer)}
        {hasBow ? <AnimatedPath animatedProps={bow} fill={bowFill} /> : null}
        {worn === 'party' ? <Path d={PARTY_HAT} fill={fill} /> : null}
        <AnimatedPath animatedProps={sym} stroke={fill} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Animated.View>
  );

  const container = useRef<ComponentRef<typeof View>>(null);
  const measure = useCallback(() => {
    container.current?.measureInWindow((x, y, w, h) => {
      center.value = { x: x + w / 2, y: y + h / 2 };
    });
  }, [center]);

  const wrapped = (
    <View
      ref={container}
      onLayout={measure}
      accessible
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${mode === 'women' ? 'Hana' : 'Hachi'}, the Commit octopus`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {drawing}
    </View>
  );

  return interactive && live ? <GestureDetector gesture={pan}>{wrapped}</GestureDetector> : wrapped;
});

type GroupProps = {
  ink: string;
  layerProps: object;
  armWidth: number;
  arms: object[];
  knot: object | null;
  face: object;
  hash: string;
};

/** One complete Hachi in one ink. Two are stacked so the red of "broken" can fade in. */
function AnimatedPathGroup({ ink, layerProps, armWidth, arms, knot, face, hash }: GroupProps) {
  return (
    <AnimatedG animatedProps={layerProps}>
      {arms.map((a, i) => (
        <AnimatedPath key={i} animatedProps={a} stroke={ink} strokeWidth={armWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {knot ? <AnimatedPath animatedProps={knot} stroke={ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      <AnimatedPath animatedProps={face} fill={ink} fillRule="evenodd" clipRule="evenodd" />
      {hash ? <Path d={hash} fill={ink} /> : null}
    </AnimatedG>
  );
}


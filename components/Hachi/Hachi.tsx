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
  sparklePath,
  symPath,
  type Cfg,
  type HachiState,
} from './model';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export type { HachiState };
export type Accessory = 'band' | 'bow' | 'party' | 'none';
export type HachiGesture = 'tap' | 'hold' | 'drag' | 'arm';

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
  /** Overrides the mode colour, for example on a coloured background. */
  color?: string;
  /** Runs the live engine. Off draws one still frame, for long lists. */
  animated?: boolean;
  /** Tap, hold, drag the body, or grab an arm. */
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
const EYE_INK = '#3A0A24';

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

const bowPath = (flap: number) => {
  'worklet';
  const { x, y } = BOW_CENTER;
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
    interactive = false,
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
  const fill = color ?? t.primary;
  const live = animated && !motionOff;
  const bowFill = mode === 'women' && !color ? '#B45CFF' : '#FF2E93';
  const darkEyes = hasBow;

  const cfg = useSharedValue<Cfg>(STATES[resolveState(state ?? 'idle')]);
  const stateClock = useSharedValue(0);
  const levelSV = useSharedValue(-1);
  const facing = useSharedValue(1);
  const center = useSharedValue({ x: -1, y: -1 });
  const reduce = useSharedValue(motionOff ? 1 : 0);
  const press = useSharedValue({ active: false, moved: false, arm: -1, dx: 0, dy: 0, tx: 0, ty: 0 });

  const initial = STATES[resolveState(state ?? 'idle')];
  const sim = useSharedValue({
    time: 0,
    blinkAt: 1.5,
    blink: 0,
    arms: [...ARM_POSES[initial.arms]],
    armsV: new Array(32).fill(0) as number[],
    knot: [...KNOT_POSES[initial.knot]],
    knotV: [0, 0, 0, 0],
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
        spark: sparklePath({ mode: c.eyes, lx: 0, ly: 0, ew: c.ew, eh: c.eh, blink: 0, bow: hasBow, micro }),
        bow: bowPath(0),
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
    const sway = c.arms === 'rest' ? 1 : 0.4;
    for (let i = 0; i < 32; i++) {
      let tt = target[i];
      const arm = Math.floor(i / 8);
      const part = i % 8;
      if (part >= 2) {
        // Idle life: tips sway in a wave along the arm, and they trail the body when dragged.
        const reach = part / 7;
        const phase = s.time * 1.8 + arm * 1.2;
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
      r = stepSpring(s.knot[i], s.knotV[i], knotT[i] + flutter - (i % 2 === 0 ? s.dx * 0.5 : s.dy * 0.4), 170, 11, dt);
      s.knot[i] = r[0];
      s.knotV[i] = r[1];
    }

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
    const spinEase = c.spin ? (1 - Math.pow(1 - s.spin, 3)) * 720 : 0;
    const level = levelSV.value;
    const amp = c.pulse ? (level >= 0 ? level : (Math.sin(s.time * 10) + 1) / 2) : 0;
    const pulse = reduce.value ? 1 : 1 + amp * 0.1;
    const drag = Math.hypot(s.dx, s.dy);
    const sx = s.sx * pulse * (1 + Math.abs(s.dx) / 260);
    const sy = s.sy * pulse * (1 + Math.abs(s.dy) / 260 - drag / 900);

    out.value = {
      arm0: armPath(s.arms, 0),
      arm1: armPath(s.arms, 1),
      arm2: armPath(s.arms, 2),
      arm3: armPath(s.arms, 3),
      knot: `M126 47L${s.knot[0].toFixed(2)} ${s.knot[1].toFixed(2)}M126 47L${s.knot[2].toFixed(2)} ${s.knot[3].toFixed(2)}`,
      eyes: eyesPath({ mode: c.eyes, lx: s.lx, ly: s.ly, ew: s.ew, eh: s.eh, blink, bow: hasBow, micro }),
      spark: sparklePath({ mode: c.eyes, lx: s.lx, ly: s.ly, ew: s.ew, eh: s.eh, blink, bow: hasBow, micro }),
      bow: bowPath(Math.max(0, Math.sin(s.time * 2.4)) * 0.5 + Math.abs(s.hopV) / 200),
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

  // Gestures, all from Arc: tap, press and hold to squeeze, drag the body, grab an arm.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holding = useRef(false);
  const tapsAt = useRef<number[]>([]);
  const prevBase = useRef<HachiState>('idle');

  const pressStart = useCallback(() => {
    holding.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holding.current = true;
      prevBase.current = base.current;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      set('squeeze');
      onGesture?.('hold');
    }, 380);
  }, [onGesture, set]);

  const pressMoved = useCallback(
    (armGrabbed: boolean) => {
      clearTimeout(holdTimer.current);
      Haptics.selectionAsync();
      onGesture?.(armGrabbed ? 'arm' : 'drag');
    },
    [onGesture],
  );

  const pressEnd = useCallback(
    (moved: boolean, big: boolean) => {
      clearTimeout(holdTimer.current);
      if (holding.current) {
        holding.current = false;
        base.current = prevBase.current;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        play('happy');
        return;
      }
      if (moved) {
        if (big) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          play('surprise');
        }
        return;
      }
      const now = Date.now();
      tapsAt.current = [...tapsAt.current.filter((x) => now - x < 1600), now];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onGesture?.('tap');
      if (tapsAt.current.length >= 5) {
        tapsAt.current = [];
        play('dizzy');
      } else {
        play(tapsAt.current.length % 2 ? 'happy' : 'wink');
      }
    },
    [onGesture, play],
  );

  const toUnits = 160 / size;
  const pan = usePanGesture({
    enabled: interactive && live,
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      const ux = e.x * toUnits;
      const uy = e.y * toUnits;
      const s = sim.value;
      let arm = -1;
      let best = 34;
      for (let i = 0; i < 4; i++) {
        const dist = Math.hypot(s.arms[i * 8 + 6] - ux, s.arms[i * 8 + 7] - uy);
        if (dist < best) {
          best = dist;
          arm = i;
        }
      }
      press.value = { active: true, moved: false, arm, dx: 0, dy: 0, tx: 0, ty: 0 };
      scheduleOnRN(pressStart);
    },
    onUpdate: (e) => {
      'worklet';
      const p = press.value;
      const ux = e.translationX * toUnits;
      const uy = e.translationY * toUnits;
      const moved = p.moved || Math.hypot(e.translationX, e.translationY) > 6;
      if (moved && !p.moved) scheduleOnRN(pressMoved, p.arm >= 0);
      press.value = {
        ...p,
        moved,
        dx: moved && p.arm < 0 ? soft(ux * 0.55, 46) : 0,
        dy: moved && p.arm < 0 ? soft(uy * 0.55, 46) : 0,
        tx: moved && p.arm >= 0 ? soft(ux, 42) : 0,
        ty: moved && p.arm >= 0 ? soft(uy, 42) : 0,
      };
    },
    onFinalize: () => {
      'worklet';
      const p = press.value;
      const big = Math.hypot(p.dx, p.dy) > 22 || Math.hypot(p.tx, p.ty) > 18;
      press.value = { active: false, moved: false, arm: -1, dx: 0, dy: 0, tx: 0, ty: 0 };
      scheduleOnRN(pressEnd, p.moved, big);
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

  const redFill = '#E5484D';
  const arm0 = useAnimatedProps(() => ({ d: out.value.arm0 }));
  const arm1 = useAnimatedProps(() => ({ d: out.value.arm1 }));
  const arm2 = useAnimatedProps(() => ({ d: out.value.arm2 }));
  const arm3 = useAnimatedProps(() => ({ d: out.value.arm3 }));
  const knot = useAnimatedProps(() => ({ d: out.value.knot }));
  const face = useAnimatedProps(() => ({ d: darkEyes ? head : head + out.value.eyes }));
  const eyeInk = useAnimatedProps(() => ({ d: out.value.eyes }));
  const spark = useAnimatedProps(() => ({ d: out.value.spark }));
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
        {darkEyes ? <AnimatedPath animatedProps={eyeInk} fill={EYE_INK} /> : null}
        {darkEyes && !micro ? <AnimatedPath animatedProps={spark} fill="#FFFFFF" /> : null}
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
      accessibilityLabel="Hachi, the Commit octopus"
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


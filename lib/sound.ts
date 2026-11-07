import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Mode } from './theme';

/** Every sound is made by scripts/sfx/make_sfx.py. Three of them change voice with the mode. */
const FILES = {
  like_normal: require('../assets/sfx/like_normal.wav'),
  like_women: require('../assets/sfx/like_women.wav'),
  like_hack: require('../assets/sfx/like_hack.wav'),
  pass_normal: require('../assets/sfx/pass_normal.wav'),
  pass_women: require('../assets/sfx/pass_women.wav'),
  pass_hack: require('../assets/sfx/pass_hack.wav'),
  tap_normal: require('../assets/sfx/tap_normal.wav'),
  tap_women: require('../assets/sfx/tap_women.wav'),
  tap_hack: require('../assets/sfx/tap_hack.wav'),
  match_normal: require('../assets/sfx/match_normal.wav'),
  match_women: require('../assets/sfx/match_women.wav'),
  match_hack: require('../assets/sfx/match_hack.wav'),
  commit_normal: require('../assets/sfx/commit_normal.wav'),
  commit_women: require('../assets/sfx/commit_women.wav'),
  commit_hack: require('../assets/sfx/commit_hack.wav'),
  super: require('../assets/sfx/super.wav'),
  undo: require('../assets/sfx/undo.wav'),
  tick: require('../assets/sfx/tick.wav'),
  toggle: require('../assets/sfx/toggle.wav'),
  mode: require('../assets/sfx/mode.wav'),
  hold: require('../assets/sfx/hold.wav'),
  msg_out: require('../assets/sfx/msg_out.wav'),
  msg_in: require('../assets/sfx/msg_in.wav'),
  error: require('../assets/sfx/error.wav'),
  ink: require('../assets/sfx/ink.wav'),
  h_happy: require('../assets/sfx/h_happy.wav'),
  h_wink: require('../assets/sfx/h_wink.wav'),
  h_poke: require('../assets/sfx/h_poke.wav'),
  h_bonk: require('../assets/sfx/h_bonk.wav'),
  h_giggle: require('../assets/sfx/h_giggle.wav'),
  h_purr: require('../assets/sfx/h_purr.wav'),
  h_jump: require('../assets/sfx/h_jump.wav'),
  h_flip: require('../assets/sfx/h_flip.wav'),
  h_dizzy: require('../assets/sfx/h_dizzy.wav'),
  h_sad: require('../assets/sfx/h_sad.wav'),
  h_wake: require('../assets/sfx/h_wake.wav'),
  h_squeeze: require('../assets/sfx/h_squeeze.wav'),
} as const;

type File = keyof typeof FILES;
type Moded = 'like' | 'pass' | 'tap' | 'match' | 'commit';
export type Sound = Moded | Exclude<File, `${Moded}_${Mode}`>;

const MODED = new Set<string>(['like', 'pass', 'tap', 'match', 'commit']);
const LEVEL: Partial<Record<Sound, number>> = { tap: 0.25, tick: 0.35, toggle: 0.5 };

let enabled = true;
let mode: Mode = 'normal';
let ready = false;
const players = new Map<File, AudioPlayer>();

const prepare = () => {
  if (ready) return;
  ready = true;
  // A demo phone on silent should still make noise. Settings has the off switch.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
};

const playerFor = (file: File) => {
  let player = players.get(file);
  if (!player) {
    player = createAudioPlayer(FILES[file]);
    players.set(file, player);
  }
  return player;
};

const fileFor = (name: Sound): File => (MODED.has(name) ? (`${name}_${mode}` as File) : (name as File));

/** Plays a sound. Never throws: a sound failing must not break what the person was doing. */
export const sfx = (name: Sound) => {
  if (!enabled) return;
  try {
    prepare();
    const player = playerFor(fileFor(name));
    player.volume = LEVEL[name] ?? 1;
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Silence is fine.
  }
};

export const stopSfx = (name: Sound) => {
  try {
    const player = players.get(fileFor(name));
    player?.pause();
    player?.seekTo(0).catch(() => {});
  } catch {
    // Nothing was playing.
  }
};

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

export const setSoundMode = (next: Mode) => {
  mode = next;
};

/** Loads the sounds used right away, so the first swipe is not late. */
export const preloadSfx = () => {
  try {
    prepare();
    (['like', 'pass', 'tap', 'match', 'commit', 'hold', 'tick'] as Sound[]).forEach((n) => playerFor(fileFor(n)));
  } catch {
    // They load on first play instead.
  }
};

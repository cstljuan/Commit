import { Easing } from 'react-native-reanimated';

/** The app's one move for anything that slides: fast start, soft landing, no bounce, like iOS. */
export const GLIDE = { duration: 280, easing: Easing.bezier(0.32, 0.72, 0, 1) };

/** Deck feel. Tune these on a real phone, not in the components. */
export const SWIPE = {
  /** Fraction of screen width to commit a left or right swipe. */
  thresholdX: 0.35,
  /** Fraction of screen height to commit a Super Commit. */
  thresholdY: 0.25,
  /** Points per second that count as a flick. */
  flickVelocity: 800,
  /** Rotation at the screen edge, in degrees. */
  maxRotateDeg: 12,
  /** Stamp starts fading in at this fraction of the screen. */
  stampStart: 0.08,
  /** Duration of a card flying off, in ms. */
  flyMs: 220,
  /** Spring for a card returning to the centre. */
  spring: { damping: 18, stiffness: 180 },
  /** Scale of the card waiting behind the top one. */
  nextScale: 0.95,
} as const;

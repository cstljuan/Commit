import type { Species } from './identity';

/**
 * One family, one set of rules, on a 100 x 100 grid: a single solid silhouette, two
 * negative-space eyes, no mouth, round stroke caps of width 7 or 8.
 */
export type Shape = {
  /** Filled paths. */
  body: string[];
  /** Stroked parts such as tentacles and legs. */
  limbs?: string[];
  eyes: [number, number];
  eyeY: number;
  /** Optional cut-out nose. */
  nose?: boolean;
};

const spiky = (cx: number, cy: number, inner: number, outer: number, spikes: number) => {
  let d = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
};

export const SHAPES: Record<Species, Shape> = {
  jellyfish: {
    body: ['M18 52C18 24 36 12 50 12C64 12 82 24 82 52C82 56 78 58 74 58H26C22 58 18 56 18 52Z'],
    limbs: ['M32 62C27 70 37 76 31 88', 'M50 62C45 72 55 78 50 92', 'M68 62C63 70 73 76 69 88'],
    eyes: [39, 61],
    eyeY: 38,
  },
  crab: {
    body: [
      'M20 56C20 42 34 34 50 34C66 34 80 42 80 56C80 68 66 76 50 76C34 76 20 68 20 56Z',
      'M6 22a11 11 0 0 1 20 -5L18 25L28 24a11 11 0 0 1 -22 -2Z',
      'M94 22a11 11 0 0 0 -20 -5L82 25L72 24a11 11 0 0 0 22 -2Z',
    ],
    limbs: ['M22 46C16 42 14 38 15 32', 'M78 46C84 42 86 38 85 32', 'M26 68L14 78', 'M36 74L28 88', 'M74 68L86 78', 'M64 74L72 88'],
    eyes: [40, 60],
    eyeY: 50,
  },
  whale: {
    body: ['M8 58C8 36 30 28 50 28C68 28 78 40 82 50C86 44 90 40 96 36C97 50 94 62 86 70C76 80 60 84 42 84C22 84 8 74 8 58Z'],
    limbs: ['M42 22C42 15 36 13 33 8', 'M42 22C42 15 48 13 51 8'],
    eyes: [28, 46],
    eyeY: 52,
  },
  puffer: {
    body: [spiky(50, 52, 31, 44, 14)],
    eyes: [39, 61],
    eyeY: 48,
  },
  shark: {
    body: ['M4 56C16 42 36 36 52 35L62 14L68 38C76 40 82 44 86 48L98 32C98 46 96 58 98 74L84 60C74 72 60 78 44 78C26 78 12 68 4 56Z'],
    eyes: [24, 40],
    eyeY: 52,
  },
  ray: {
    body: ['M50 22C64 22 68 32 96 46C80 62 64 64 56 72L52 94H48L44 72C36 64 20 62 4 46C32 32 36 22 50 22Z'],
    eyes: [40, 60],
    eyeY: 42,
  },
  turtle: {
    body: [
      'M10 62C10 38 28 24 48 24C68 24 84 38 84 62C84 65 82 66 79 66H15C12 66 10 65 10 62Z',
      'M80 38C84 30 96 32 97 42C98 50 90 56 84 52Z',
    ],
    limbs: ['M26 72L20 86', 'M68 72L74 86', 'M12 62L4 68'],
    eyes: [36, 58],
    eyeY: 44,
  },
  axolotl: {
    body: ['M20 58C20 42 34 32 50 32C66 32 80 42 80 58C80 74 66 84 50 84C34 84 20 74 20 58Z'],
    limbs: ['M26 44C18 42 13 36 11 26', 'M21 54C13 53 7 49 4 42', 'M23 66C14 67 8 64 4 59', 'M74 44C82 42 87 36 89 26', 'M79 54C87 53 93 49 96 42', 'M77 66C86 67 92 64 96 59'],
    eyes: [33, 67],
    eyeY: 54,
  },
  cat: {
    body: ['M16 14L36 30C44 27 56 27 64 30L84 14V58C84 76 68 88 50 88C32 88 16 76 16 58V14Z'],
    eyes: [36, 64],
    eyeY: 54,
    nose: true,
  },
  dog: {
    body: [
      'M30 28C38 20 62 20 70 28C78 36 80 48 78 60C76 76 64 88 50 88C36 88 24 76 22 60C20 48 22 36 30 28Z',
      'M32 26C18 20 6 30 8 52C10 64 20 62 25 50Z',
      'M68 26C82 20 94 30 92 52C90 64 80 62 75 50Z',
    ],
    eyes: [39, 61],
    eyeY: 50,
    nose: true,
  },
};

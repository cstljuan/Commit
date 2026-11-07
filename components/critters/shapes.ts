import type { Species } from './identity';

/**
 * Hachi's family: the same build on the same 160 grid. A capsule body, thick round limbs
 * whose roots sit inside the body so they can never look detached, big round cut-out eyes
 * and no mouth. Only Hachi gets a headband or eight-limbed octopus body.
 */
export type Shape = {
  /** Filled parts. The first carries the face. */
  body: string[];
  /** Stroked limbs. Width is LIMB unless the limb asks for its own. */
  limbs?: (string | { d: string; w: number })[];
  eyes: [number, number];
  eyeY: number;
  eyeR?: number;
  nose?: boolean;
};

export const LIMB = 15;

const spikes = (cx: number, cy: number, r0: number, r1: number, n: number) => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    out.push(`M${(cx + r0 * Math.cos(a)).toFixed(1)} ${(cy + r0 * Math.sin(a)).toFixed(1)}L${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}`);
  }
  return out;
};

const mirror = (d: string) =>
  // Mirrors absolute paths made only of M, L and C across the middle of the grid.
  d.replace(/([MLC])([^MLC]*)/g, (_, cmd: string, rest: string) => {
    const nums = rest.trim().split(/[ ,]+/).map(Number);
    return cmd + nums.map((n, i) => (i % 2 === 0 ? 160 - n : n)).join(' ');
  });

const both = (...ds: string[]) => ds.flatMap((d) => [d, mirror(d)]);

export const SHAPES: Record<Species, Shape> = {
  jellyfish: {
    body: ['M28 72A52 56 0 0 1 132 72C132 84 124 90 114 90H46C36 90 28 84 28 72Z'],
    limbs: ['M52 84C44 102 62 116 50 142', 'M80 84C72 106 90 122 80 152', 'M108 84C100 102 118 116 110 142'],
    eyes: [60, 100],
    eyeY: 60,
  },
  crab: {
    body: [
      'M28 88C28 66 52 58 80 58C108 58 132 66 132 88C132 108 108 118 80 118C52 118 28 108 28 88Z',
      'M4 30A18 18 0 0 1 36 18L22 30L40 32A18 18 0 0 1 4 30Z',
      'M156 30A18 18 0 0 0 124 18L138 30L120 32A18 18 0 0 0 156 30Z',
    ],
    limbs: [...both('M38 76C24 70 18 56 22 38', 'M42 106C36 120 28 128 14 134', 'M62 112C60 126 54 138 42 150')],
    eyes: [60, 100],
    eyeY: 84,
  },
  whale: {
    body: ['M12 90C12 58 44 42 78 42C112 42 132 62 136 80C142 68 148 60 158 54C160 78 154 100 140 112C124 126 100 132 70 132C36 132 12 116 12 90Z'],
    limbs: ['M72 44C72 28 60 22 54 10', 'M72 44C72 28 84 22 90 10', 'M60 124C56 136 46 146 32 150'],
    eyes: [44, 84],
    eyeY: 86,
  },
  puffer: {
    body: ['M36 84A44 44 0 1 1 124 84A44 44 0 1 1 36 84Z'],
    limbs: spikes(80, 84, 38, 66, 12).map((d) => ({ d, w: 13 })),
    eyes: [62, 98],
    eyeY: 78,
  },
  shark: {
    body: [
      'M8 94C24 64 54 52 88 52C112 52 130 64 138 80C144 70 150 62 158 56C160 82 158 104 152 124C148 112 144 106 136 100C122 120 98 130 70 128C44 126 22 114 8 94Z',
      'M70 58C74 40 88 26 104 20C102 34 104 48 108 60Z',
    ],
    limbs: ['M78 118C76 132 68 144 54 150'],
    eyes: [44, 80],
    eyeY: 88,
  },
  ray: {
    body: ['M80 40C98 40 104 54 150 76C156 79 156 85 150 88C124 102 104 106 96 116C90 122 70 122 64 116C56 106 36 102 10 88C4 85 4 79 10 76C56 54 62 40 80 40Z'],
    limbs: [{ d: 'M80 112C80 128 84 142 98 154', w: 11 }],
    eyes: [62, 98],
    eyeY: 74,
  },
  turtle: {
    body: [
      'M18 96C18 60 46 42 78 42C110 42 138 60 138 96C138 104 132 108 126 108H30C24 108 18 104 18 96Z',
      'M122 72C126 50 158 50 158 74C158 92 138 100 126 92Z',
    ],
    limbs: ['M44 100C42 118 38 130 26 142', 'M112 100C114 118 118 130 130 142', { d: 'M22 98C14 100 8 104 4 110', w: 11 }],
    eyes: [58, 98],
    eyeY: 74,
  },
  axolotl: {
    body: ['M30 88C30 62 52 48 80 48C108 48 130 62 130 88C130 112 108 124 80 124C52 124 30 112 30 88Z'],
    limbs: [
      ...both('M40 68C28 62 20 52 18 36', 'M34 84C22 82 12 74 6 62', 'M38 102C26 104 16 100 8 90').map((d) => ({ d, w: 11 })),
      ...both('M58 114C56 128 50 140 40 150'),
    ],
    eyes: [56, 104],
    eyeY: 86,
  },
  cat: {
    body: ['M34 26L58 44C70 40 90 40 102 44L126 26V92C126 106 106 114 80 114C54 114 34 106 34 92V26Z'],
    limbs: [...both('M58 104C58 122 54 136 42 150'), 'M118 96C140 98 154 86 150 62'],
    eyes: [60, 100],
    eyeY: 74,
    nose: true,
  },
  dog: {
    body: ['M36 48C36 26 58 16 80 16C102 16 124 26 124 48V88C124 104 106 114 80 114C54 114 36 104 36 88V48Z'],
    limbs: [
      ...both('M42 34C22 30 14 48 20 74').map((d) => ({ d, w: 24 })),
      ...both('M58 104C58 122 54 136 42 150'),
      'M116 104C130 108 142 104 148 92',
    ],
    eyes: [60, 100],
    eyeY: 62,
    eyeR: 11,
    nose: true,
  },
};

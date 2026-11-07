/**
 * Everyone's creature comes from their key, so the same key always gives the same creature.
 * It is a friendly fingerprint, not a security check: with 100 combinations two people can
 * share one. Real verification is the signature check in lib/vault.ts.
 */
export const SPECIES = ['jellyfish', 'crab', 'whale', 'puffer', 'shark', 'ray', 'turtle', 'axolotl', 'cat', 'dog'] as const;
export type Species = (typeof SPECIES)[number];

export const COLOURS = [
  { name: 'Coral', hex: '#FF6B4A' },
  { name: 'Amber', hex: '#E89B00' },
  { name: 'Lime', hex: '#6DB80A' },
  { name: 'Teal', hex: '#00A99D' },
  { name: 'Sky', hex: '#1E9BF0' },
  { name: 'Indigo', hex: '#4C5FD5' },
  { name: 'Violet', hex: '#9B51E0' },
  { name: 'Magenta', hex: '#E6399B' },
  { name: 'Rust', hex: '#C8552B' },
  { name: 'Forest', hex: '#2E9E5B' },
] as const;

// FNV-1a, for an even spread. Not cryptographic, and it does not need to be.
function hash(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function critterFor(seed: string) {
  const h = hash(seed);
  const species = SPECIES[h % SPECIES.length];
  const colour = COLOURS[Math.floor(h / SPECIES.length) % COLOURS.length];
  return {
    species,
    colour: colour.hex,
    name: `${colour.name} ${species[0].toUpperCase()}${species.slice(1)}`,
    fingerprint: h.toString(16).padStart(8, '0').slice(0, 6),
  };
}

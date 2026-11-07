/**
 * Everyone's creature comes from their key, so the same key always gives the same creature.
 * It is a friendly fingerprint, not a security check: with 100 combinations two people can
 * share one. Real verification is the signature check in lib/vault.ts.
 */
export const SPECIES = ['jellyfish', 'crab', 'whale', 'puffer', 'shark', 'ray', 'turtle', 'axolotl', 'cat', 'dog'] as const;
export type Species = (typeof SPECIES)[number];

export const COLORS = [
  { name: 'Coral', hex: '#E8552F' },
  { name: 'Amber', hex: '#C97A00' },
  { name: 'Aonori', hex: '#4E8A1E' },
  { name: 'Teal', hex: '#00877D' },
  { name: 'Sky', hex: '#1579C4' },
  { name: 'Navy', hex: '#1D3A5F' },
  { name: 'Plum', hex: '#A23E6D' },
  { name: 'Ginger', hex: '#D4376B' },
  { name: 'Rust', hex: '#B84A24' },
  { name: 'Forest', hex: '#2A8550' },
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
  const color = COLORS[Math.floor(h / SPECIES.length) % COLORS.length];
  return {
    species,
    color: color.hex,
    name: `${color.name} ${species[0].toUpperCase()}${species.slice(1)}`,
    fingerprint: h.toString(16).padStart(8, '0').slice(0, 6),
  };
}

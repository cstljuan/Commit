import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { COLOURS, SPECIES, type Species } from '@/components/critters/identity';
import { useMode, type ThemeTokens } from '@/lib/theme';

/**
 * Illustrated avatars, never photos. One solid shape with negative-space eyes, same rules as Tako.
 * Stored on the profile as avatarUrl "avatar:<id>", for example "avatar:blob-like".
 */
const SHAPES = {
  blob: 'M50 6C78 6 94 24 94 50C94 78 76 94 50 94C24 94 6 78 6 50C6 24 22 6 50 6Z',
  square: 'M24 8H76C86 8 92 14 92 24V76C92 86 86 92 76 92H24C14 92 8 86 8 76V24C8 14 14 8 24 8Z',
  ghost: 'M50 6C76 6 92 26 92 50V92L78 82L64 92L50 82L36 92L22 82L8 92V50C8 26 24 6 50 6Z',
  cat: 'M14 10L36 26C40 25 45 24 50 24C55 24 60 25 64 26L86 10L88 48C92 56 94 64 94 70C94 86 74 94 50 94C26 94 6 86 6 70C6 64 8 56 12 48Z',
} as const;

const COLORS = ['primary', 'like', 'accent', 'pass'] as const satisfies readonly (keyof ThemeTokens)[];

type Shape = keyof typeof SHAPES;
type ColorKey = (typeof COLORS)[number];

const EYES = 'M30 54a6 8 0 1 0 12 0a6 8 0 1 0 -12 0ZM58 54a6 8 0 1 0 12 0a6 8 0 1 0 -12 0Z';

export const AVATAR_IDS: string[] = (Object.keys(SHAPES) as Shape[]).flatMap((s) => COLORS.map((c) => `${s}-${c}`));

export function avatarUrlFor(id: string) {
  return `avatar:${id}`;
}

function parse(idOrUrl: string | null | undefined): { shape: Shape; color: ColorKey } {
  const id = (idOrUrl ?? '').replace(/^avatar:/, '');
  const [shape, color] = id.split('-') as [Shape, ColorKey];
  return {
    shape: shape in SHAPES ? shape : 'blob',
    color: (COLORS as readonly string[]).includes(color) ? color : 'primary',
  };
}

export function Avatar({ id, size = 64 }: { id: string | null | undefined; size?: number }) {
  const { t } = useMode();
  const { shape, color } = parse(id);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Avatar">
      <Path fill={t[color]} fillRule="evenodd" clipRule="evenodd" d={SHAPES[shape] + EYES} />
    </Svg>
  );
}

/** Creature avatars: "critter:<species>:<colour index>", picked in onboarding. */
export function critterAvatarUrl(species: Species, colour: number) {
  return `critter:${species}:${colour}`;
}

export function critterChoice(url: string | null | undefined): { species: Species; colour: string } | null {
  const m = /^critter:([a-z]+):(\d+)$/.exec(url ?? '');
  if (!m || !(SPECIES as readonly string[]).includes(m[1])) return null;
  return { species: m[1] as Species, colour: COLOURS[Number(m[2]) % COLOURS.length].hex };
}

/** Shows the picked creature, or the one the seed gives when nothing was picked. */
export function ProfileCreature({ url, seed, size = 84, animated = false }: { url: string | null | undefined; seed: string; size?: number; animated?: boolean }) {
  const pick = critterChoice(url);
  return <Critter seed={seed} species={pick?.species} colour={pick?.colour} size={size} animated={animated} />;
}

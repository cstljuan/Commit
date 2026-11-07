import { useMode, type Mode } from '@/lib/theme';

/**
 * Hachi ("eight") runs Normal and Hack mode. Hana ("flower"), with the bow and lashes, runs Women mode.
 * Same octopus build, two characters.
 */
export const mascotName = (mode: Mode) => (mode === 'women' ? 'Hana' : 'Hachi');

export const useMascotName = () => mascotName(useMode().mode);

import { Text, View } from 'react-native';

import { radius, space, type } from '@/lib/tokens';
import { useMode } from '@/lib/theme';

/** Anything committed shows one of these. Mono means machine truth. `solid` sits on a colour block. */
export function HashChip({ hash, label = 'commit', center = false, solid = false }: { hash: string; label?: string; center?: boolean; solid?: boolean }) {
  const { t } = useMode();
  return (
    <View
      accessibilityLabel={`${label} ${hash.slice(0, 7)}`}
      style={{ flexDirection: 'row', alignSelf: center ? 'center' : 'flex-start', gap: space.xs, borderRadius: radius.full, paddingVertical: space.xs, paddingHorizontal: space.s + 2, backgroundColor: solid ? '#FFFFFF' : `${t.primary}1F` }}>
      <Text style={{ color: solid ? '#6B5044' : t.muted, fontFamily: 'JetBrainsMono_400Regular', fontSize: type.micro }}>{label}</Text>
      <Text style={{ color: solid ? '#2A1408' : t.text, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.micro }}>{hash.slice(0, 7)}</Text>
    </View>
  );
}

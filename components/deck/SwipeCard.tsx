import { StyleSheet, Text, View } from 'react-native';

import { useMode } from '@/lib/theme';

/** Static first pass for test 7. Drag, stamps and haptics land in components/deck next. */
export function SwipeCard() {
  const { t, mode } = useMode();
  const hack = mode === 'hack';
  return (
    <View style={[styles.card, { backgroundColor: t.surface, shadowColor: t.primary }]}>
      <View style={[styles.art, { backgroundColor: t.primary + '24' }]} />
      <Text style={[styles.title, { color: t.text, fontFamily: t.fontDisplay }]}>
        {hack ? '@maya_builds' : 'AI study buddy'}
      </Text>
      <Text style={[styles.body, { color: t.muted, fontFamily: t.fontBody }]}>
        {hack
          ? 'TypeScript, Postgres, Rust. Student. Worst commit message: "fix fix fix"'
          : 'Turns your notes into quizzes that find what you keep forgetting.'}
      </Text>
      <Text style={[styles.roles, { color: t.text, fontFamily: t.fontBold }]}>
        {hack ? 'Need 2 Backend, 1 Design' : 'Need 1 Backend, 1 Design'}
      </Text>
      <View style={[styles.pill, { backgroundColor: t.like + '2E' }]}>
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 13 }}>
          {hack ? 'fills: backend' : 'Fills your backend gap'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 32,
    padding: 24,
    gap: 12,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  art: { height: 150, borderRadius: 20 },
  title: { fontSize: 30 },
  body: { fontSize: 16, lineHeight: 22 },
  roles: { fontSize: 16 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
});

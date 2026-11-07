import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useMode } from '@/lib/theme';

/** Owner: niki-agent. The dev-test link goes away once test 1 has passed on a real iPhone. */
export default function ProfileScreen() {
  const { t } = useMode();
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28 }}>Profile</Text>
      <Link href="/lab" style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 16 }}>
        Proof
      </Link>
      <Link href="/dev-test" style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>
        Run first test
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});

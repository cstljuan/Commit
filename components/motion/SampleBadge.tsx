import { Text, View } from 'react-native';

/** Honest label for anything that is not a real measurement yet. Delete when wired. */
export function SampleBadge({ color, background }: { color: string; background: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: background, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text style={{ color, fontFamily: 'JetBrainsMono_700Bold', fontSize: 11 }}>SAMPLE DATA</Text>
    </View>
  );
}

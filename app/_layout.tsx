import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import '../global.css';

import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Figtree_400Regular, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Shrikhand_400Regular } from '@expo-google-fonts/shrikhand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IntroSplash } from '@/components/motion/IntroSplash';
import { ModeWipeProvider } from '@/components/motion/ModeWipe';
import { PrefsProvider } from '@/lib/prefs';
import { ModeProvider, useMode } from '@/lib/theme';

function AppStack() {
  const { mode, t } = useMode();
  return (
    <>
      <StatusBar barStyle={mode === 'hack' ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          headerTransparent: false,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: t.fontBold },
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    Shrikhand_400Regular,
  });
  // Never block the app on fonts: if they fail, it still opens.
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModeProvider>
        <PrefsProvider>
          <ModeWipeProvider>
            <AppStack />
            <IntroSplash />
          </ModeWipeProvider>
        </PrefsProvider>
      </ModeProvider>
    </GestureHandlerRootView>
  );
}

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import '../global.css';

import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Figtree_400Regular, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Shrikhand_400Regular } from '@expo-google-fonts/shrikhand';
import { useFonts } from 'expo-font';
import { router, Stack, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IntroSplash } from '@/components/motion/IntroSplash';
import { ModeWipeProvider } from '@/components/motion/ModeWipe';
import { API_IS_MOCK, getMyProfile } from '@/lib/api';
import { noteTouch, noteTouchStart } from '@/lib/hachi';
import { PrefsProvider } from '@/lib/prefs';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ModeProvider, useMode } from '@/lib/theme';
import { configureCyberClient } from '@/lib/vault';

if (isSupabaseConfigured) configureCyberClient(supabase);

/** Signed out goes to login, signed in with no profile goes to onboarding. Off while the API is the mock. */
function useSignInGate() {
  const ready = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!ready || API_IS_MOCK || !isSupabaseConfigured) return;
    const route = async (signedIn: boolean) => {
      if (!signedIn) return router.replace('/login');
      const profile = await getMyProfile().catch(() => null);
      if (!profile) router.replace('/onboarding/profile');
    };
    supabase.auth.getSession().then(({ data }) => route(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') route(false);
    });
    return () => data.subscription.unsubscribe();
  }, [ready]);
}

function AppStack() {
  const { mode, t } = useMode();
  useSignInGate();
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
    <GestureHandlerRootView
      style={{ flex: 1 }}
      onTouchStart={(e) => {
        noteTouchStart();
        noteTouch(e.nativeEvent.pageX, e.nativeEvent.pageY, performance.now());
      }}
      onTouchMove={(e) => noteTouch(e.nativeEvent.pageX, e.nativeEvent.pageY, performance.now())}>
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

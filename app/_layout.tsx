import { Fragment, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import Transition, { withScreenTransitions, type ScreenTransitionConfig } from 'react-native-screen-transitions';
import { useReducedMotion } from 'react-native-reanimated';

import { initializeDatabase } from '@/src/db/client';
import { seedHikesIfEmpty } from '@/src/db/seed';
import { useTheme } from '@/src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

// Adapt Expo Router's own stack so its routing and navigation context stay intact.
const TransitionStack = withScreenTransitions({
  Navigator: Stack,
  Screen: Stack.Screen,
  Group: Fragment,
}).Navigator;

function trailTransition(id: string) {
  return {
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    transitionSpec: Transition.Specs.Zoom,
    screenStyleInterpolator: ({ bounds }) => {
      'worklet';
      return bounds(`trail-${id}`).navigation.zoom({ target: 'fullscreen', borderRadius: 0 });
    },
  } satisfies ScreenTransitionConfig;
}

// Both are synchronous and idempotent, and the schema has to exist before any
// screen queries it. Doing this at module scope rather than in an effect means
// the first render already has a usable database, with no loading state and no
// setState-in-effect cascade.
initializeDatabase();
seedHikesIfEmpty();

export default function RootLayout() {
  const { name, colors } = useTheme();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    SplashScreen.hideAsync()
      .then(() => {
        if (active && __DEV__) console.info('[stim:readiness] ready');
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
          <TransitionStack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="trail/[id]"
              options={({ route }) => {
                const id = (route.params as { id?: string } | undefined)?.id;
                return {
                  title: 'Trail',
                  headerShown: false,
                  ...(id && !reducedMotion
                    ? { ...trailTransition(id), enableTransitions: true }
                    : { animation: 'none' as const }),
                };
              }}
            />
            <Stack.Screen name="hike/[id]" options={{ title: 'Hike' }} />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </TransitionStack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

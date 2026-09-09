import { Fragment, useEffect, type ComponentProps, type ComponentType } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import Transition, { withScreenTransitions, type NativeStackAdapterOptions, type ScreenTransitionConfig } from 'react-native-screen-transitions';
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

type RouterScreenProps = ComponentProps<typeof Stack.Screen>;
type RouterScreenOptionsCallback = Extract<RouterScreenProps['options'], (...args: never[]) => unknown>;
type TransitionScreenOptions = NativeStackAdapterOptions<ReturnType<RouterScreenOptionsCallback>>;

// The adapter accepts gesture directions beyond Expo Router's native-stack types.
const TransitionScreen = Stack.Screen as ComponentType<Omit<RouterScreenProps, 'options'> & {
  options?: TransitionScreenOptions | ((props: Parameters<RouterScreenOptionsCallback>[0]) => TransitionScreenOptions);
}>;

function trailTransition(id: string) {
  return {
    navigationMaskEnabled: Platform.OS === 'ios',
    gestureEnabled: true,
    gestureDirection: ['horizontal', 'horizontal-inverted', 'vertical'],
    transitionSpec: Transition.Specs.Zoom,
    screenStyleInterpolator: ({ bounds }) => {
      'worklet';
      return bounds(`trail-${id}`).navigation.zoom({ target: 'bound', borderRadius: 48 });
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
            <TransitionScreen
              name="trail/[id]"
              options={({ route }) => {
                const id = (route.params as { id?: string } | undefined)?.id;
                return {
                  title: 'Trail',
                  headerShown: false,
                  // Keep the list visible behind the library's animated content and backdrop.
                  contentStyle: { backgroundColor: 'transparent' },
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

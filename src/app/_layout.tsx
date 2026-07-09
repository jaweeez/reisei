import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { color, fontModules } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Never strand the app on the splash: a font-load failure falls through to system fonts.
  const [loaded, fontError] = useFonts(fontModules);
  const ready = loaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: color.bg }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="landing" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="verify-email" />
              <Stack.Screen name="forgot-pin" />
              <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
              <Stack.Screen name="ledger" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reset" options={{ presentation: 'modal' }} />
              <Stack.Screen name="bearing" options={{ presentation: 'modal' }} />
            </Stack>
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

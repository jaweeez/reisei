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
  const [loaded] = useFonts(fontModules);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

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

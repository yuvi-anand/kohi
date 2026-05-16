import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import { LocationProvider } from '../context/location';
import { ShopsProvider } from '../context/shops';
import { isSupabaseConfigured } from '../lib/supabase';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // If Supabase isn't configured yet, skip auth and go straight to the app
    if (!isSupabaseConfigured()) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen
        name="shop/[id]"
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="rate/[id]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <ShopsProvider>
          <RootLayoutNav />
        </ShopsProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

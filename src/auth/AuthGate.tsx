import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthProvider';
import { routeFor } from './routeFor';

// Mengarahkan ke grup rute yang sesuai keadaan masuk/onboarding.
export function AuthGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const target = loading
    ? null
    : routeFor({ session: !!session, onboardingSelesai: profile ? profile.onboarding_selesai : null });
  const group = segments[0] as string | undefined;

  useEffect(() => {
    if (!target) return;
    // '/(auth)/masuk' -> '(auth)'
    const targetGroup = target.split('/')[1];
    if (group !== targetGroup) router.replace(target);
  }, [target, group, router]);
  return null;
}

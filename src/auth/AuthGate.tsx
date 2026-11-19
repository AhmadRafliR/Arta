import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthProvider';
import { routeFor } from './routeFor';
import { gateView } from './gateView';

// Mengarahkan ke grup rute sesuai keadaan masuk/onboarding. Children (Stack) tetap ter-mount
// agar router.replace bekerja; tampilan memuat / galat ditumpuk di atasnya.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onboardingSelesai = profile ? profile.onboarding_selesai : null;
  const group = segments[0] as string | undefined;
  const target = loading || (!!session && profileError) ? null : routeFor({ session: !!session, onboardingSelesai });

  useEffect(() => {
    if (!target) return;
    // '/(auth)/masuk' -> '(auth)'
    if (group !== target.split('/')[1]) router.replace(target);
  }, [target, group, router]);

  const view = gateView({ loading, session: !!session, profileError, onboardingSelesai, group });

  return (
    <>
      {children}
      {view === 'loading' ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-bg">
          <ActivityIndicator />
        </View>
      ) : null}
      {view === 'error' ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center gap-4 bg-bg px-6">
          <Text className="text-xl font-bold text-fg">Gagal memuat profil</Text>
          <Pressable onPress={refreshProfile} className="items-center rounded-xl bg-acc px-6 py-3">
            <Text className="font-semibold text-white">Coba lagi</Text>
          </Pressable>
          <Pressable onPress={() => void signOut()} className="items-center rounded-xl border border-line bg-card px-6 py-3">
            <Text className="font-semibold text-fg">Keluar</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

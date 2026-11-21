import { useEffect, useLayoutEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthProvider';
import { routeFor } from './routeFor';
import { ambilBaruMasuk } from './baruMasuk';
import { useTransisi } from '@/animasi/TransisiProvider';
import { gateView, routeAllowed } from './gateView';
import { MarkMuat } from '@/components/MarkMuat';
import { Tombol } from '@/components/Tombol';

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
    if (!routeAllowed(target, group)) router.replace(target);
  }, [target, group, router]);

  const view = gateView({ loading, session: !!session, profileError, onboardingSelesai, group });

  // Momen penting: baru masuk (OTP/Google) -> putar transisi menabung sampai profil termuat dan rute
  // settle. useLayoutEffect agar overlay terpasang sebelum frame pertama setelah sesi muncul.
  // Sesi tersimpan saat app dibuka ulang tidak ditandai, jadi tidak memutar transisi.
  const { putar } = useTransisi();
  const lepasTunggu = useRef<(() => void) | null>(null);
  const userId = session?.user.id ?? null;
  useLayoutEffect(() => {
    if (!userId || !ambilBaruMasuk()) return;
    const tunggu = new Promise<void>((resolve) => {
      lepasTunggu.current = resolve;
    });
    void putar({ judul: 'Menyiapkan dompetmu', tunggu });
  }, [userId, putar]);
  useEffect(() => {
    if ((view !== 'loading' || !userId) && lepasTunggu.current) {
      lepasTunggu.current();
      lepasTunggu.current = null;
    }
  }, [view, userId]);

  return (
    <>
      {children}
      {view === 'loading' ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-bg">
          <MarkMuat />
        </View>
      ) : null}
      {view === 'error' ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center gap-4 bg-bg px-6">
          <Text className="text-xl font-bold text-fg font-sans">Gagal memuat profil</Text>
          <Tombol primary label="Coba lagi" onPress={refreshProfile} />
          <Tombol label="Keluar" onPress={() => void signOut()} />
        </View>
      ) : null}
    </>
  );
}

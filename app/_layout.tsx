import '../global.css';
import { useCallback, useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AuthGate } from '@/auth/AuthGate';
import { QueryCacheGuard } from '@/auth/QueryCacheGuard';
import { ThemeProfileBridge } from '@/auth/ThemeProfileBridge';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Pref } from '@/theme/tokens';
import { LanggananProvider } from '@/langganan/LanggananProvider';
import { pasangPenangan } from '@/notifikasi/penangan';
import { useSinkronPush } from '@/notifikasi/sinkron';

// Urutan provider: QueryClientProvider > AuthProvider > ThemeShell(ThemeProvider) > ...
// ThemeProvider berada DI DALAM AuthProvider agar onPrefChange bisa melihat sesi
// (menulis profiles.mode_tampilan), dan ThemeProfileBridge (di dalam keduanya) menerapkan
// mode_tampilan profil ke tema setelah masuk.
function ThemeShell({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const onPrefChange = useCallback(
    (p: Pref) => {
      if (!userId) return;
      supabase
        .from('profiles')
        .update({ mode_tampilan: p })
        .eq('id', userId)
        .then(undefined, () => {});
    },
    [userId],
  );
  return <ThemeProvider onPrefChange={onPrefChange}>{children}</ThemeProvider>;
}

// Penangan notifikasi (tampil saat app terbuka + ketuk → buka rute internal). Dipasang sekali.
function PenanganNotifikasi() {
  const router = useRouter();
  useEffect(() => pasangPenangan(router), [router]);
  return null;
}

function SinkronPush() {
  useSinkronPush();
  return null;
}

// Pendaftaran ulang token push hanya untuk sesi yang sudah masuk (RPC butuh auth).
function SinkronPushBersesi() {
  const { session } = useAuth();
  return session ? <SinkronPush /> : null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryCacheGuard />
        <LanggananProvider>
          <ThemeShell>
            <ThemeProfileBridge />
            <PenanganNotifikasi />
            <SinkronPushBersesi />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="catat" options={{ presentation: "modal" }} />
                <Stack.Screen name="transaksi/[id]" options={{ presentation: "modal" }} />
                <Stack.Screen name="dompet/[id]" options={{ presentation: "modal" }} />
                <Stack.Screen name="dompet/baru" options={{ presentation: "modal" }} />
                <Stack.Screen name="premium" options={{ presentation: "modal" }} />
                <Stack.Screen name="ekspor" options={{ presentation: "modal" }} />
                <Stack.Screen name="hapus-akun" options={{ presentation: "modal" }} />
              </Stack>
            </AuthGate>
          </ThemeShell>
        </LanggananProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

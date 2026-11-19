import '../global.css';
import { useCallback, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AuthGate } from '@/auth/AuthGate';
import { ThemeProfileBridge } from '@/auth/ThemeProfileBridge';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Pref } from '@/theme/tokens';

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

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeShell>
          <ThemeProfileBridge />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="catat" options={{ presentation: "modal" }} />
              <Stack.Screen name="transaksi/[id]" options={{ presentation: "modal" }} />
            </Stack>
          </AuthGate>
        </ThemeShell>
      </AuthProvider>
    </QueryClientProvider>
  );
}

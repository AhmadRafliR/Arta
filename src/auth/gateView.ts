import { routeFor } from './routeFor';

export type GateView = 'loading' | 'error' | 'ready';

/**
 * Apakah rute aktif (segmen pertama) sudah sesuai tujuan? '/(auth)/masuk' -> grup '(auth)'.
 * Untuk '/(tabs)', rute apa pun di luar (auth) dan (onboarding) (mis. /catat, /transaksi/[id])
 * dianggap boleh; tujuan lain tetap ketat.
 */
export function routeAllowed(target: string, group: string | undefined): boolean {
  if (group === undefined) return false;
  const targetGroup = target.split('/')[1];
  if (targetGroup === '(tabs)') return group !== '(auth)' && group !== '(onboarding)';
  return group === targetGroup;
}

// Keputusan tampilan gerbang: spinner, layar gagal-profil, atau konten (Stack) terlihat.
// Konten baru terlihat setelah rute aktif sesuai tujuan, supaya tidak berkedip.
export function gateView(s: {
  loading: boolean;
  session: boolean;
  profileError: boolean;
  onboardingSelesai: boolean | null;
  group: string | undefined;
}): GateView {
  if (s.loading) return 'loading';
  if (s.session && s.profileError) return 'error';
  const target = routeFor({ session: s.session, onboardingSelesai: s.onboardingSelesai });
  if (!target) return 'loading';
  return routeAllowed(target, s.group) ? 'ready' : 'loading';
}

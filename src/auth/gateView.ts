import { routeFor } from './routeFor';

export type GateView = 'loading' | 'error' | 'ready';

// Keputusan tampilan gerbang: spinner, layar gagal-profil, atau konten (Stack) terlihat.
// Konten baru terlihat setelah grup rute aktif sama dengan tujuan, supaya tidak berkedip.
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
  return target.split('/')[1] === s.group ? 'ready' : 'loading';
}

export type AuthRoute = '/(auth)/masuk' | '/(onboarding)/dompet-awal' | '/(tabs)';

// null = masih memuat (sesi ada, profil belum terbaca).
export function routeFor(state: { session: boolean; onboardingSelesai: boolean | null }): AuthRoute | null {
  if (!state.session) return '/(auth)/masuk';
  if (state.onboardingSelesai === null) return null;
  return state.onboardingSelesai ? '/(tabs)' : '/(onboarding)/dompet-awal';
}

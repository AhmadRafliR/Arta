import { routeFor } from '../routeFor';

describe('routeFor', () => {
  it('tanpa sesi -> masuk', () => {
    expect(routeFor({ session: false, onboardingSelesai: null })).toBe('/(auth)/masuk');
  });
  it('sesi + onboarding belum selesai -> dompet awal', () => {
    expect(routeFor({ session: true, onboardingSelesai: false })).toBe('/(onboarding)/dompet-awal');
  });
  it('sesi + onboarding selesai -> tabs', () => {
    expect(routeFor({ session: true, onboardingSelesai: true })).toBe('/(tabs)');
  });
  it('sesi + profil belum termuat -> null', () => {
    expect(routeFor({ session: true, onboardingSelesai: null })).toBeNull();
  });
});

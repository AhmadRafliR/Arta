import { gateView } from '../gateView';

const base = { loading: false, session: true, profileError: false, onboardingSelesai: true, group: '(tabs)' as string | undefined };

describe('gateView', () => {
  it('memuat -> loading', () => {
    expect(gateView({ ...base, loading: true })).toBe('loading');
  });
  it('sesi + gagal memuat profil -> error', () => {
    expect(gateView({ ...base, profileError: true, onboardingSelesai: null })).toBe('error');
  });
  it('tanpa sesi di rute lain -> loading sampai dialihkan', () => {
    expect(gateView({ ...base, session: false, onboardingSelesai: null, group: '(tabs)' })).toBe('loading');
  });
  it('tanpa sesi di (auth) -> ready', () => {
    expect(gateView({ ...base, session: false, onboardingSelesai: null, group: '(auth)' })).toBe('ready');
  });
  it('sesi, onboarding belum, di tabs -> loading (akan dialihkan)', () => {
    expect(gateView({ ...base, onboardingSelesai: false })).toBe('loading');
  });
  it('sesi, onboarding selesai, di tabs -> ready', () => {
    expect(gateView(base)).toBe('ready');
  });
});

describe('gateView: rute di luar grup saat target (tabs)', () => {
  it('/catat (modal di luar grup) -> ready', () => {
    expect(gateView({ ...base, group: 'catat' })).toBe('ready');
  });
  it('(auth) atau (onboarding) saat target (tabs) -> loading', () => {
    expect(gateView({ ...base, group: '(auth)' })).toBe('loading');
    expect(gateView({ ...base, group: '(onboarding)' })).toBe('loading');
  });
  it('group belum diketahui -> loading', () => {
    expect(gateView({ ...base, group: undefined })).toBe('loading');
  });
  it('target (onboarding) tetap ketat: /catat -> loading', () => {
    expect(gateView({ ...base, onboardingSelesai: false, group: 'catat' })).toBe('loading');
  });
  it('target (auth) tetap ketat: /catat -> loading', () => {
    expect(gateView({ ...base, session: false, onboardingSelesai: null, group: 'catat' })).toBe('loading');
  });
});

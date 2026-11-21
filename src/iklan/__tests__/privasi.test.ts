import { AdsConsent } from 'react-native-google-mobile-ads';
import { perluPengaturanPrivasiIklan, setelUlangIklan } from '../mulai';

const getConsentInfo = AdsConsent.getConsentInfo as jest.Mock;
const gatherConsent = AdsConsent.gatherConsent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setelUlangIklan();
});

it('wilayah yang mewajibkan (UMP REQUIRED): true', async () => {
  getConsentInfo.mockResolvedValueOnce({ canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
  await expect(perluPengaturanPrivasiIklan()).resolves.toBe(true);
  expect(gatherConsent).toHaveBeenCalled();
});

it('pengguna menolak persetujuan tetap mendapat tombol untuk mengubahnya', async () => {
  gatherConsent.mockResolvedValueOnce({ canRequestAds: false });
  getConsentInfo.mockResolvedValueOnce({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
  await expect(perluPengaturanPrivasiIklan()).resolves.toBe(true);
});

it('tidak diwajibkan (mis. Indonesia) atau galat: false', async () => {
  getConsentInfo.mockResolvedValueOnce({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  await expect(perluPengaturanPrivasiIklan()).resolves.toBe(false);
  getConsentInfo.mockRejectedValueOnce(new Error('belum siap'));
  await expect(perluPengaturanPrivasiIklan()).resolves.toBe(false);
});

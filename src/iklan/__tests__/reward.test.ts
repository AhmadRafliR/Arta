import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { setelUlangIklan } from '../mulai.native';
import { tontonIklanReward } from '../reward.native';

type Pendengar = Record<string, () => void>;

function iklanPalsu(urut: (p: Pendengar) => void) {
  const pendengar: Pendengar = {};
  const iklan = {
    addAdEventListener: jest.fn((tipe: string, cb: () => void) => {
      pendengar[tipe] = cb;
      return jest.fn();
    }),
    load: jest.fn(() => setTimeout(() => urut(pendengar), 0)),
    show: jest.fn(async () => undefined),
  };
  (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(iklan);
  return iklan;
}

beforeEach(() => {
  jest.clearAllMocks();
  setelUlangIklan();
});

describe('tontonIklanReward', () => {
  it('hadiah diterima lalu ditutup: selesai', async () => {
    const iklan = iklanPalsu((p) => {
      p[RewardedAdEventType.LOADED]();
      p[RewardedAdEventType.EARNED_REWARD]();
      p[AdEventType.CLOSED]();
    });
    await expect(tontonIklanReward()).resolves.toBe('selesai');
    expect(iklan.show).toHaveBeenCalledTimes(1);
  });

  it('ditutup sebelum hadiah: dibatalkan', async () => {
    iklanPalsu((p) => {
      p[RewardedAdEventType.LOADED]();
      p[AdEventType.CLOSED]();
    });
    await expect(tontonIklanReward()).resolves.toBe('dibatalkan');
  });

  it('galat memuat: gagal', async () => {
    iklanPalsu((p) => p[AdEventType.ERROR]());
    await expect(tontonIklanReward()).resolves.toBe('gagal');
  });
});

import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { mulaiIklan, unitReward } from './mulai';

/** selesai = hadiah diterima (iklan ditonton penuh); dibatalkan = ditutup lebih awal; gagal = tidak termuat. */
export type HasilReward = 'selesai' | 'dibatalkan' | 'gagal' | 'tidak-tersedia';

export const BATAS_MUAT_MS = 20000;

/** Muat dan tampilkan satu iklan reward. Hadiah hanya sah bila EARNED_REWARD diterima sebelum iklan ditutup. */
export async function tontonIklanReward(): Promise<HasilReward> {
  const unit = unitReward();
  if (unit === null) return 'tidak-tersedia';
  if (!(await mulaiIklan())) return 'tidak-tersedia';

  return new Promise<HasilReward>((resolve) => {
    const iklan = RewardedAd.createForAdRequest(unit);
    let hadiah = false;
    let selesai = false;
    const lepas: (() => void)[] = [];
    const akhiri = (h: HasilReward) => {
      if (selesai) return;
      selesai = true;
      clearTimeout(batas);
      lepas.forEach((f) => f());
      resolve(h);
    };
    const batas = setTimeout(() => akhiri('gagal'), BATAS_MUAT_MS);

    lepas.push(
      iklan.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(batas); // sudah termuat; pengguna boleh menonton selama yang dibutuhkan
        iklan.show().catch(() => akhiri('gagal'));
      }),
      iklan.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        hadiah = true;
      }),
      iklan.addAdEventListener(AdEventType.CLOSED, () => akhiri(hadiah ? 'selesai' : 'dibatalkan')),
      iklan.addAdEventListener(AdEventType.ERROR, () => akhiri('gagal')),
    );
    iklan.load();
  });
}

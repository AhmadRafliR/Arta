// Web: tidak ada iklan reward. Versi native ada di reward.native.ts.
export type HasilReward = 'selesai' | 'dibatalkan' | 'gagal' | 'tidak-tersedia';

export async function tontonIklanReward(): Promise<HasilReward> {
  return 'tidak-tersedia';
}

import { Platform } from 'react-native';
import mobileAds, { AdsConsent, MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';
import { pilihUnitId } from './config';

let janji: Promise<boolean> | null = null;

/**
 * Consent (UMP) lalu inisialisasi SDK, sekali per proses. true bila iklan boleh diminta.
 * Konten umum (rating G/PG); bukan aplikasi anak.
 */
export function mulaiIklan(): Promise<boolean> {
  if (!janji) {
    janji = (async () => {
      try {
        const { canRequestAds } = await AdsConsent.gatherConsent();
        if (!canRequestAds) return false;
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
        return true;
      } catch {
        janji = null; // boleh dicoba lagi saat app dibuka berikutnya
        return false;
      }
    })();
  }
  return janji;
}

/** Hanya untuk tes: lupakan hasil inisialisasi sebelumnya. */
export function setelUlangIklan(): void {
  janji = null;
}

/** Formulir pilihan privasi iklan (wajib disediakan di wilayah yang mensyaratkannya). */
export async function bukaPengaturanPrivasiIklan(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch {
    // abaikan
  }
}

export function unitBanner(): string | null {
  const produksi =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS
      : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  return pilihUnitId({ dev: __DEV__, uji: TestIds.ADAPTIVE_BANNER, produksi });
}

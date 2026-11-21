import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAuth } from '@/auth/AuthProvider';
import { usePro } from '@/data/langganan';
import { mulaiIklan, unitBanner } from '@/iklan/mulai';

/**
 * Banner iklan di akhir layar baca. Hanya untuk pengguna yang sudah masuk dan BUKAN Pro.
 * Selama status Pro belum pasti, tidak ditampilkan (agar pelanggan tak sempat melihat iklan).
 * Gagal memuat → tidak menyisakan ruang kosong.
 */
export function BannerIklan() {
  const { session } = useAuth();
  const { pro, memuat } = usePro();
  const unit = unitBanner();
  const boleh = !!session && !memuat && !pro && unit !== null;
  const [siap, setSiap] = useState(false);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    if (!boleh) return;
    let batal = false;
    void mulaiIklan().then((ok) => {
      if (!batal) setSiap(ok);
    });
    return () => {
      batal = true;
    };
  }, [boleh]);

  if (!boleh || !siap || gagal || unit === null) return null;
  return (
    <View testID="banner-iklan" accessibilityLabel="Iklan" className="items-center overflow-hidden rounded-2xl">
      <BannerAd
        unitId={unit}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => setGagal(true)}
      />
    </View>
  );
}

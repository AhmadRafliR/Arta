import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { pilihPenyedia } from './penyedia';
import type { PenyediaLangganan } from './tipe';

export const LanggananContext = createContext<PenyediaLangganan | null>(null);

let bawaan: PenyediaLangganan | null = null;

function penyediaBawaan(): PenyediaLangganan {
  bawaan ??= pilihPenyedia({
    apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    platform: Platform.OS,
    dev: __DEV__,
  });
  return bawaan;
}

/** Menyambungkan penyedia ke sesi: masuk(userId) saat login, keluar() saat logout. */
export function LanggananProvider({
  children,
  penyedia,
}: {
  children: React.ReactNode;
  penyedia?: PenyediaLangganan;
}) {
  const { session } = useAuth();
  const nilai = useMemo(() => penyedia ?? penyediaBawaan(), [penyedia]);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    (userId ? nilai.masuk(userId) : nilai.keluar()).catch(() => {});
  }, [nilai, userId]);

  return <LanggananContext.Provider value={nilai}>{children}</LanggananContext.Provider>;
}

/**
 * Penyedia aktif. Tanpa Provider (mis. tes layar) jatuh ke penyedia bawaan hasil pilihPenyedia
 * (mock saat dev tanpa kunci), supaya layar bisa dirender tanpa membungkus apa pun.
 */
export function useLangganan(): PenyediaLangganan {
  return useContext(LanggananContext) ?? penyediaBawaan();
}

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/auth/AuthProvider';
import { usePro } from '@/data/langganan';
import { usePengaturanPengingat } from '@/data/pengingat';
import { daftarkanPush } from './push';

/**
 * Daftarkan ulang token push tanpa memunculkan dialog izin: hanya bila izin sudah diberikan.
 * Token Expo bisa berganti (instal ulang, restore), jadi dipanggil setiap app dibuka.
 */
export async function sinkronkanPushDiam(): Promise<void> {
  try {
    const izin = await Notifications.getPermissionsAsync();
    if (!izin.granted) return;
    await daftarkanPush();
  } catch {
    // abaikan: pengguna bisa menyalakan ulang dari Akun
  }
}

/** Pengguna Pro dengan pengingat aktif: pastikan token perangkat ini terdaftar ke akunnya. */
export function useSinkronPush(): void {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { pro } = usePro();
  const pengaturan = usePengaturanPengingat();
  const aktif = pengaturan.data?.aktif ?? true;
  const siap = !!userId && pro && pengaturan.isSuccess && aktif;

  useEffect(() => {
    if (siap) void sinkronkanPushDiam();
  }, [siap, userId]);
}

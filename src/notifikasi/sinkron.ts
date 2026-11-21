import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { usePro } from '@/data/langganan';
import { PENGINGAT_DEFAULT, usePengaturanPengingat } from '@/data/pengingat';
import { useTagihanMendatang } from '@/data/tagihanMendatang';
import { susunJadwalPengingat } from './jadwalPengingat';
import { batalkanPengingat, izinSudahDiberikan, jadwalkanUlangPengingat } from './lokal';

/**
 * Pengingat jatuh tempo lokal: jadwalkan ulang notifikasi di perangkat setiap tagihan/pengaturan berubah
 * dan saat app kembali ke foreground. Tanpa dialog izin; bila izin belum ada, tidak menjadwalkan apa pun.
 * Logout / non-Pro / dimatikan -> batalkan semua pengingat.
 */
export function useSinkronPengingat(): void {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? null;
  const zona = profile?.zona_waktu ?? null;
  const { pro, memuat } = usePro();
  const pengaturan = usePengaturanPengingat();
  const p = pengaturan.data ?? PENGINGAT_DEFAULT;
  const nyala = !!userId && pro && pengaturan.isSuccess && p.aktif;
  const tagihan = useTagihanMendatang(zona, nyala);
  const data = nyala && tagihan.isSuccess ? tagihan.data : undefined;

  const jalankan = useMemo(
    () => async () => {
      if (!data) return;
      if (!(await izinSudahDiberikan())) return;
      await jadwalkanUlangPengingat(
        susunJadwalPengingat({
          tagihan: data,
          hariSebelum: p.hari_sebelum,
          jam: p.jam,
          zona,
          sekarang: new Date(),
        }),
      );
    },
    [data, p.hari_sebelum, p.jam, zona],
  );

  useEffect(() => {
    void jalankan();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void jalankan();
    });
    return () => sub.remove();
  }, [jalankan]);

  // Batalkan hanya setelah status pasti (jangan menghapus jadwal selagi Pro/pengaturan masih memuat).
  const pasti = !userId || (!memuat && (!pro || pengaturan.isSuccess));
  useEffect(() => {
    if (pasti && !nyala) void batalkanPengingat();
  }, [pasti, nyala]);
}

/** Nama lama, dipertahankan sebagai alias. */
export const useSinkronPush = useSinkronPengingat;

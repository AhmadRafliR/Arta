import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { setDraf } from '@/ai/drafStore';
import type { DrafTx } from '@/ai/tipe';
import { useAuth } from '@/auth/AuthProvider';
import { useWallets } from '@/data/wallets';
import { hariIni } from '@/lib/tanggal';
import { ambilAntrean, aktif, hapusDariAntrean, tambahPendengar, tersedia } from '../../modules/notifikasi-dompet';
import { jadikanDraf, transkripSumber } from './draf';
import { parseNotifikasi, type HasilNotif } from './parser';

export const MAKS_TERAKHIR = 20;

/** Satu notifikasi yang terbaca di antrean (hanya di memori, untuk layar pengaturan). */
export type NotifTerbaca = {
  kunci: string;
  paket: string;
  judul: string;
  teks: string;
  waktu: number;
  /** true bila parser mengenalinya sebagai transaksi. */
  terbaca: boolean;
};

type State = { hasil: HasilNotif[]; terakhir: NotifTerbaca[] };

// Status bersama (Beranda, layar pengaturan) di memori. Antrean asli ada di modul native.
let state: State = { hasil: [], terakhir: [] };
const pendengar = new Set<() => void>();

function tetapkan(baru: State) {
  state = baru;
  pendengar.forEach((p) => p());
}

function langgan(cb: () => void) {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
}

function amanParse(n: Parameters<typeof parseNotifikasi>[0]): HasilNotif | null {
  try {
    return parseNotifikasi(n);
  } catch {
    return null;
  }
}

/**
 * Baca antrean native lalu urai. Yang terurai tetap di antrean sampai draf tersimpan; yang tidak terurai
 * (promo, OTP, gagal) langsung dibuang dari antrean, tetapi 20 terakhir diingat di memori untuk layar pengaturan.
 */
export function sinkronAntrean() {
  let antrean: ReturnType<typeof ambilAntrean> = [];
  try {
    if (!tersedia() || !aktif()) {
      if (state.hasil.length > 0) tetapkan({ ...state, hasil: [] });
      return;
    }
    antrean = ambilAntrean();
  } catch {
    return;
  }
  const hasil: HasilNotif[] = [];
  const buang: string[] = [];
  const peta = new Map(state.terakhir.map((x) => [x.kunci, x]));
  for (const n of antrean) {
    const h = amanParse(n);
    peta.set(n.kunci, { kunci: n.kunci, paket: n.paket, judul: n.judul, teks: n.teks, waktu: n.waktu, terbaca: !!h });
    if (h) hasil.push(h);
    else buang.push(n.kunci);
  }
  if (buang.length > 0) {
    try {
      hapusDariAntrean(buang);
    } catch {
      // Gagal membuang: akan dicoba lagi pada sinkron berikutnya.
    }
  }
  const terakhir = [...peta.values()].sort((a, b) => b.waktu - a.waktu).slice(0, MAKS_TERAKHIR);
  tetapkan({ hasil, terakhir });
}

/** Berlangganan perubahan antrean: saat dipasang, saat app aktif kembali, dan saat ada notifikasi baru. */
function usePantauAntrean() {
  useEffect(() => {
    sinkronAntrean();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sinkronAntrean();
    });
    let pendengarNative: { remove(): void } | null = null;
    try {
      if (tersedia()) pendengarNative = tambahPendengar(() => sinkronAntrean());
    } catch {
      pendengarNative = null;
    }
    return () => {
      sub.remove();
      pendengarNative?.remove();
    };
  }, []);
}

const ambil = () => state;

/** Notifikasi terakhir yang terbaca (maks 20, hanya di memori) untuk layar pengaturan. */
export function useNotifikasiTerakhir(): NotifTerbaca[] {
  usePantauAntrean();
  return useSyncExternalStore(langgan, ambil, ambil).terakhir;
}

/** Notifikasi dompet yang siap dicek: jumlah, draf, dan `bukaUntukCek` yang mengisi draf store lalu membuka /cek. */
export function useNotifikasiDompet(): { jumlah: number; draf: DrafTx[]; bukaUntukCek: () => void } {
  usePantauAntrean();
  const router = useRouter();
  const { profile } = useAuth();
  const wallets = useWallets().data;
  const { hasil } = useSyncExternalStore(langgan, ambil, ambil);
  const zona = profile?.zona_waktu || undefined;
  const draf = useMemo(() => jadikanDraf(hasil, wallets ?? [], zona), [hasil, wallets, zona]);

  function bukaUntukCek() {
    // Tunggu daftar dompet agar pemetaan dompet tidak keliru.
    if (draf.length === 0 || !wallets) return;
    const kunci = hasil.map((h) => h.kunci);
    setDraf(
      {
        draf,
        koreksi: [],
        tidakDidukung: [],
        butuh_klarifikasi: false,
        pertanyaan: null,
        transkrip: transkripSumber(hasil),
        // Layar cek tidak memakai kuota; nilai netral agar tidak ada tampilan kuota yang keliru.
        kuota: { bulan: hariIni(zona).slice(0, 7), terpakai: 0, batas: 0, pro: false },
      },
      // Simpan berhasil: seluruh kelompok yang dicek (yang dihapus pengguna di layar cek ikut dianggap selesai).
      () => {
        try {
          hapusDariAntrean(kunci);
        } catch {
          // Draf punya id tetap, jadi tercatat ulang pun tidak dobel.
        }
        sinkronAntrean();
      },
    );
    router.push('/cek');
  }

  return { jumlah: draf.length, draf, bukaUntukCek };
}

/** Hanya untuk tes: kosongkan status memori. */
export function resetStatusNotifikasi() {
  tetapkan({ hasil: [], terakhir: [] });
}

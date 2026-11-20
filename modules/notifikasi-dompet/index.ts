import { Platform, requireOptionalNativeModule } from 'expo';

export type NotifikasiMentah = {
  kunci: string; // unik per notifikasi: `${sbn.key}:${sbn.postTime}`
  paket: string; // package name sumber
  judul: string; // EXTRA_TITLE ('' bila kosong)
  teks: string; // EXTRA_BIG_TEXT bila ada, selain itu EXTRA_TEXT ('' bila kosong)
  waktu: number; // postTime, milidetik epoch
};

type ModulNative = {
  tersedia(): boolean;
  izinAktif(): boolean;
  bukaPengaturanIzin(): void;
  aktif(): boolean;
  setAktif(nilai: boolean): void;
  ambilAntrean(): NotifikasiMentah[];
  hapusDariAntrean(kunci: string[]): void;
  addListener(nama: 'onNotifikasi', cb: (n: NotifikasiMentah) => void): { remove(): void };
};

// Hanya dicari di Android; di iOS/web/Jest hasilnya null dan semua fungsi menjadi no-op.
const modul: ModulNative | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<ModulNative>('NotifikasiDompet') : null;

/** true hanya di Android dengan modul native terpasang. */
export function tersedia(): boolean {
  try {
    return modul?.tersedia() ?? false;
  } catch {
    return false;
  }
}

/** Listener diizinkan di pengaturan sistem. */
export function izinAktif(): boolean {
  try {
    return modul?.izinAktif() ?? false;
  } catch {
    return false;
  }
}

/** Membuka Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS. */
export function bukaPengaturanIzin(): void {
  try {
    modul?.bukaPengaturanIzin();
  } catch {
    // diabaikan
  }
}

/** Sakelar fitur di app (bawaan false). */
export function aktif(): boolean {
  try {
    return modul?.aktif() ?? false;
  } catch {
    return false;
  }
}

/** Saat false, service mengabaikan notifikasi. */
export function setAktif(nilai: boolean): void {
  try {
    modul?.setAktif(nilai);
  } catch {
    // diabaikan
  }
}

/** Antrean notifikasi mentah, urut waktu naik. */
export function ambilAntrean(): NotifikasiMentah[] {
  try {
    return modul?.ambilAntrean() ?? [];
  } catch {
    return [];
  }
}

export function hapusDariAntrean(kunci: string[]): void {
  try {
    if (kunci.length > 0) modul?.hapusDariAntrean(kunci);
  } catch {
    // diabaikan
  }
}

/** Dengarkan event 'onNotifikasi' saat app hidup. */
export function tambahPendengar(cb: (n: NotifikasiMentah) => void): { remove(): void } {
  try {
    const langganan = modul?.addListener('onNotifikasi', cb);
    if (langganan) return { remove: () => langganan.remove() };
  } catch {
    // jatuh ke no-op
  }
  return { remove() {} };
}

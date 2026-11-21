// Penanda "baru saja masuk" (OTP / Google). Dipasang SEBELUM memanggil API masuk, karena
// onAuthStateChange bisa terpicu sebelum await selesai. AuthGate menghabiskannya sekali saat
// sesi muncul untuk memutar transisi; sesi tersimpan saat app dibuka ulang tidak punya penanda.
let baruMasuk = false;

export function tandaiBaruMasuk(): void {
  baruMasuk = true;
}

export function batalkanBaruMasuk(): void {
  baruMasuk = false;
}

/** Mengembalikan true sekali saja setelah ditandai. */
export function ambilBaruMasuk(): boolean {
  const v = baruMasuk;
  baruMasuk = false;
  return v;
}

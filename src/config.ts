export const APP_NAME = 'keuangan-app';

// Halaman web statis (folder web/, di-host Rafli). Diisi lewat env saat rilis; lihat docs/rilis-play-store.md.
export const URL_KEBIJAKAN_PRIVASI =
  process.env.EXPO_PUBLIC_URL_KEBIJAKAN_PRIVASI || 'https://example.com/arta/kebijakan-privasi.html';
export const URL_HAPUS_AKUN =
  process.env.EXPO_PUBLIC_URL_HAPUS_AKUN || 'https://example.com/arta/hapus-akun.html';

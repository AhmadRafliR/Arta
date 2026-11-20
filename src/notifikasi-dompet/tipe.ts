// Salinan tipe notifikasi mentah dari modul native `modules/notifikasi-dompet`.
// Sengaja didefinisikan ulang agar parser tidak bergantung pada modul native;
// harus identik dengan `NotifikasiMentah` di modul itu.
export type NotifikasiMentah = {
  kunci: string;
  paket: string;
  judul: string;
  teks: string;
  waktu: number;
};

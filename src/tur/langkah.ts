import type { NamaIkon } from '@/components/ikon/data';

export type RuteTur = '/' | '/riwayat' | '/hutang' | '/akun';

export type LangkahTur = {
  id: string;
  judul: string;
  isi: string;
  ikon: NamaIkon;
  /** Tab yang dibuka sebelum langkah ini tampil. */
  rute?: RuteTur;
  /** Id <TargetTur> yang disorot; tanpa target, kartu tampil di tengah. */
  target?: string;
  /** Sudut sorotan; 999 untuk lingkaran/kapsul. */
  radius?: number;
  /** Hanya untuk perangkat dengan catat otomatis dari notifikasi (Android). */
  butuhNotifDompet?: boolean;
};

/** Tur seluruh fitur arta, urut mengikuti layar: Beranda, tombol catat, Riwayat, Hutang, Akun. */
export const LANGKAH_TUR: LangkahTur[] = [
  {
    id: 'sambut',
    judul: 'Kenalan dulu sama arta',
    isi: 'Tur singkat ini mengenalkan semua fitur, sekitar satu menit. Bisa dilewati, dan bisa diulang kapan saja dari Akun.',
    ikon: 'ui-spark',
  },
  {
    id: 'saldo',
    judul: 'Sisa uang dan kekayaan bersih',
    isi: 'Sisa uang adalah total semua dompet harianmu. Kekayaan bersih ikut menghitung dana darurat dan investasi, dikurangi sisa hutang.',
    ikon: 'ui-money',
    rute: '/',
    target: 'beranda-saldo',
    radius: 24,
  },
  {
    id: 'aksi',
    judul: 'Jalan pintas',
    isi: 'Catat transaksi dengan mengetik, buka Hutang, atau lihat Riwayat langsung dari kartu saldo.',
    ikon: 'act-ketik',
    rute: '/',
    target: 'beranda-aksi',
    radius: 16,
  },
  {
    id: 'dompet',
    judul: 'Saldo tiap dompet',
    isi: 'GoPay, ShopeePay, cash, rekening. Ketuk dompet untuk melihat detail, mengganti nama, atau menyesuaikan saldonya.',
    ikon: 'wallet-harian',
    rute: '/',
    target: 'beranda-dompet',
    radius: 22,
  },
  {
    id: 'notif',
    judul: 'Catat otomatis dari notifikasi',
    isi: 'arta membaca notifikasi GoPay dan ShopeePay lalu menyiapkan drafnya. Titik hijau di tombol ini berarti ada transaksi yang siap kamu cek.',
    ikon: 'ui-bell',
    rute: '/',
    target: 'beranda-notif',
    radius: 999,
    butuhNotifDompet: true,
  },
  {
    id: 'tema',
    judul: 'Mode terang dan gelap',
    isi: 'Ganti tampilan kapan saja dengan satu ketukan. Pilihanmu tersimpan di akun.',
    ikon: 'ui-moon',
    rute: '/',
    target: 'beranda-tema',
    radius: 999,
  },
  {
    id: 'diagram',
    judul: 'Ke mana uangmu',
    isi: 'Diagram pengeluaran bulan ini per kategori. Ketuk kategori untuk menyorotnya. Budget yang hampir habis juga muncul di Beranda.',
    ikon: 'ui-percent',
    rute: '/',
    target: 'beranda-diagram',
    radius: 22,
  },
  {
    id: 'catat',
    judul: 'Catat pakai suara',
    isi: 'Tekan mic lalu bicara, misalnya "makan siang 25 ribu pakai GoPay". AI menyiapkan drafnya, kamu cek dulu sebelum disimpan.',
    ikon: 'act-mic',
    target: 'tab-catat',
    radius: 999,
  },
  {
    id: 'riwayat',
    judul: 'Riwayat transaksi',
    isi: 'Semua transaksi per bulan, bisa difilter per dompet dan jenis. Ketuk transaksi untuk mengubah atau menghapusnya.',
    ikon: 'nav-riwayat',
    rute: '/riwayat',
    target: 'tab-riwayat',
    radius: 18,
  },
  {
    id: 'hutang',
    judul: 'Hutang dan cicilan',
    isi: 'Catat hutang, jadwal cicilan, dan pembayarannya. Bisa diisi otomatis dari screenshot tagihan, plus pengingat sebelum jatuh tempo.',
    ikon: 'nav-hutang',
    rute: '/hutang',
    target: 'tab-hutang',
    radius: 18,
  },
  {
    id: 'akun-dompet',
    judul: 'Kelola dompet',
    isi: 'Tambah dompet harian, dana darurat, atau investasi. Sesuaikan saldo dan arsipkan dompet yang sudah tidak dipakai.',
    ikon: 'ui-wallet-plus',
    rute: '/akun',
    target: 'akun-dompet',
    radius: 20,
  },
  {
    id: 'budget',
    judul: 'Budget bulanan',
    isi: 'Pasang batas per kategori atau untuk seluruh pengeluaran. arta mengingatkan saat budget terpakai 80%.',
    ikon: 'ui-budget',
    rute: '/akun',
    target: 'akun-budget',
    radius: 14,
  },
  {
    id: 'darurat',
    judul: 'Dana darurat',
    isi: 'Tentukan target, setor dan tarik, lalu lihat berapa bulan pengeluaranmu aman tertutup.',
    ikon: 'ui-shield',
    rute: '/akun',
    target: 'akun-darurat',
    radius: 14,
  },
  {
    id: 'investasi',
    judul: 'Investasi',
    isi: 'Pantau nilai aset seperti emas, saham, reksa dana, atau kripto, lengkap dengan untung ruginya.',
    ikon: 'wallet-investasi',
    rute: '/akun',
    target: 'akun-investasi',
    radius: 14,
  },
  {
    id: 'laporan',
    judul: 'Laporan email dan ekspor',
    isi: 'Kirim ringkasan bulanan ke email atau ekspor data ke Excel dan CSV. Fitur Pro, atau buka gratis dengan menonton iklan.',
    ikon: 'ui-ekspor',
    rute: '/akun',
    target: 'akun-laporan',
    radius: 14,
  },
  {
    id: 'selesai',
    judul: 'Siap mencatat!',
    isi: 'Mulai dari tombol mic di tengah bawah. Tur ini bisa diulang dari Akun, bagian Bantuan.',
    ikon: 'ui-check',
    rute: '/',
  },
];

/** Langkah yang berlaku di perangkat ini. */
export function langkahUntuk(opsi: { notifDompet: boolean }): LangkahTur[] {
  return LANGKAH_TUR.filter((l) => !l.butuhNotifDompet || opsi.notifDompet);
}

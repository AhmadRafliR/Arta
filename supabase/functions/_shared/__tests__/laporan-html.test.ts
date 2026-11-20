import { buatIsiLaporan, type DataLaporan } from '../laporan/isi';
import { renderLaporan } from '../laporan/html';

const DATA: DataLaporan = {
  nama: 'Rafli',
  zona: 'Asia/Jakarta',
  wallets: [
    { id: 'g', nama: 'GoPay', tipe: 'harian', saldo_awal: 100000, target: null, diarsip: false },
    { id: 'd', nama: 'Dana darurat', tipe: 'darurat', saldo_awal: 1000000, target: 3000000, diarsip: false },
    { id: 's', nama: 'Saham', tipe: 'investasi', saldo_awal: 500000, target: null, diarsip: false },
  ],
  txs: [
    { id: '1', tanggal: '2026-11-02', jenis: 'pemasukan', kategori: 'ortu', nominal: 1500000, wallet_id: 'g', wallet_tujuan_id: null, catatan: null },
    { id: '2', tanggal: '2026-11-03', jenis: 'pengeluaran', kategori: 'rokok', nominal: 390000, wallet_id: 'g', wallet_tujuan_id: null, catatan: '<script>alert(1)</script>' },
  ],
  budgets: [{ kategori: 'rokok', batas_bulanan: 300000 }],
  hutang: [{ pemberi: 'Kredivo & Co', sisa_pokok: 1200000, jatuh_tempo_berikutnya: null, nominal_berikutnya: null, diarsip: false }],
};

const OPSI = { urlBerhenti: 'https://x.test/henti?t=a&b=c' };

describe('renderLaporan', () => {
  const r = renderLaporan(buatIsiLaporan(DATA, '2026-11'), OPSI);

  it('subjek dan isi utama', () => {
    expect(r.subjek).toBe('Laporan keuangan November 2026 · Rafli');
    expect(r.html).toContain('Rp1.500.000');
    expect(r.html).toContain('November 2026');
    expect(r.html).toContain('Lewat');
    expect(r.html).toContain('Total saldo semua dompet');
    expect(r.teks).toContain('Rp1.500.000');
    expect(r.teks).toContain('Lewat');
  });

  it('subjek tanpa nama memakai arta', () => {
    const x = renderLaporan(buatIsiLaporan({ ...DATA, nama: null }, '2026-11'), OPSI);
    expect(x.subjek).toBe('Laporan keuangan November 2026 · arta');
  });

  it('meng-escape teks pengguna', () => {
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(r.html).toContain('Kredivo &amp; Co');
    const x = renderLaporan(buatIsiLaporan({ ...DATA, nama: `<b>"x"</b>'` }, '2026-11'), OPSI);
    expect(x.html).not.toContain('<b>');
    expect(x.html).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;&#39;');
  });

  it('tautan berhenti ada (ter-escape di HTML, polos di teks)', () => {
    expect(r.html).toContain('href="https://x.test/henti?t=a&amp;b=c"');
    expect(r.teks).toContain('https://x.test/henti?t=a&b=c');
    expect(r.html).toContain('menambahkanmu sebagai penerima laporan di arta');
  });

  it('tanpa gambar remote, tabel, inline style', () => {
    expect(r.html).not.toMatch(/<img|<link|<style|<script/i);
    expect(r.html).toContain('<table');
    expect(r.html).toContain('#0B424F');
    expect(r.html).toContain('#52C3BF');
    expect(r.html).toContain('#EEF3F5');
  });

  it('bagian kosong dilewati', () => {
    const polos = renderLaporan(
      buatIsiLaporan(
        { ...DATA, wallets: DATA.wallets.filter((w) => w.tipe === 'harian'), hutang: null },
        '2026-11',
      ),
      OPSI,
    );
    expect(polos.html).not.toContain('Dana darurat');
    expect(polos.html).not.toContain('Investasi');
    expect(polos.html).not.toContain('Hutang');
    expect(polos.teks).not.toContain('DANA DARURAT');
    expect(r.html).toContain('Dana darurat');
    expect(r.html).toContain('Investasi');
    expect(r.html).toContain('Hutang');
  });
});

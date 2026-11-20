/// <reference types="node" />
import * as Sharing from 'expo-sharing';
import { batasRentang, jalankanEkspor, namaBerkas, susunEkspor } from '../ekspor';
import { SUMBER_EKSPOR } from '../sumber';
import { MIME_XLSX } from '../xlsx';

const mockTabel: Record<string, Record<string, unknown>[]> = {};
const mockFilter: { tabel: string; op: string; kolom: string; nilai: unknown }[] = [];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabel: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.order = () => b;
      b.gte = (kolom: string, nilai: unknown) => (mockFilter.push({ tabel, op: 'gte', kolom, nilai }), b);
      b.lte = (kolom: string, nilai: unknown) => (mockFilter.push({ tabel, op: 'lte', kolom, nilai }), b);
      b.range = async (a: number, z: number) => ({ data: (mockTabel[tabel] ?? []).slice(a, z + 1), error: null });
      return b;
    },
  },
}));

const mockCreate = jest.fn();
const mockWrite = jest.fn(async (_isi: unknown) => undefined);
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(dir: { uri: string }, nama: string) {
      this.uri = `${dir.uri}${nama}`;
    }
    create(o: unknown) {
      mockCreate(o);
    }
    write(isi: unknown) {
      return mockWrite(isi);
    }
  },
}));

/** Ambil isi entri ZIP (store) lewat central directory. */
function entriZip(z: Uint8Array): Record<string, string> {
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const e = z.length - 22;
  let p = dv.getUint32(e + 16, true);
  const hasil: Record<string, string> = {};
  for (let i = 0; i < dv.getUint16(e + 10, true); i++) {
    const ukuran = dv.getUint32(p + 24, true);
    const pNama = dv.getUint16(p + 28, true);
    const off = dv.getUint32(p + 42, true);
    const nama = Buffer.from(z.subarray(p + 46, p + 46 + pNama)).toString('utf8');
    const mulai = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    hasil[nama] = Buffer.from(z.subarray(mulai, mulai + ukuran)).toString('utf8');
    p += 46 + pNama + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return hasil;
}

// 2026-11-20 10:00 WIB
const SEKARANG = new Date('2026-11-20T03:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockFilter.length = 0;
  mockTabel.wallets = [
    { id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 5000, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
    { id: 'w2', nama: 'Dana Darurat', tipe: 'darurat', saldo_awal: '0', tanggal_saldo_awal: '2026-11-01', target: 9000000, diarsip: true },
  ];
  mockTabel.categories = [{ id: 'c1', jenis: 'pengeluaran', nama: 'Makan' }];
  mockTabel.transactions = [
    { id: 't1', tanggal: '2026-11-02', jenis: 'pengeluaran', kategori: 'Makan', nominal: 288000, wallet_id: 'w1', wallet_tujuan_id: null, catatan: 'Nasi, "padang"\nenak', sumber: 'ai' },
    { id: 't2', tanggal: '2026-11-03', jenis: 'transfer', kategori: null, nominal: '100000', wallet_id: 'w1', wallet_tujuan_id: 'w2', catatan: '=1+1', sumber: 'manual' },
    { id: 't3', tanggal: '2026-11-04', jenis: 'penyesuaian', kategori: null, nominal: -2500, wallet_id: 'w1', wallet_tujuan_id: 'w2', catatan: null, sumber: 'import' },
  ];
});

describe('batasRentang (Asia/Jakarta)', () => {
  it('semua -> null', () => {
    expect(batasRentang('semua', 'Asia/Jakarta', SEKARANG)).toBeNull();
  });
  it('bulan & tahun ini memakai tanggal WIB, bukan UTC', () => {
    // 31 Des 2026 18:00 UTC = 1 Jan 2027 01:00 WIB
    const t = new Date('2026-12-31T18:00:00Z');
    expect(batasRentang('tahun', 'Asia/Jakarta', t)).toEqual({ dari: '2027-01-01', sampai: '2027-12-31' });
    expect(batasRentang('bulan', 'Asia/Jakarta', t)).toEqual({ dari: '2027-01-01', sampai: '2027-01-31' });
    expect(batasRentang('bulan', 'Asia/Jakarta', new Date('2028-02-10T00:00:00Z'))).toEqual({
      dari: '2028-02-01',
      sampai: '2028-02-29',
    });
  });
  it('nama berkas', () => {
    expect(namaBerkas('xlsx', 'Asia/Jakarta', new Date('2026-11-20T18:00:00Z'))).toBe('arta-ekspor-2026-11-21.xlsx');
    expect(namaBerkas('csv', 'Asia/Jakarta', SEKARANG)).toBe('arta-ekspor-2026-11-20.csv');
  });
});

describe('susunEkspor', () => {
  it('CSV: hanya transaksi, nominal angka, nama dompet, dompet tujuan hanya transfer, aman injeksi', async () => {
    const b = await susunEkspor('csv', 'semua', 'Asia/Jakarta', SEKARANG);
    expect(b.nama).toBe('arta-ekspor-2026-11-20.csv');
    expect(b.mime).toBe('text/csv');
    expect(b.isi).toBe(
      '﻿' +
        'Tanggal,Jenis,Kategori,Nominal,Dompet,Dompet tujuan,Catatan,Sumber\r\n' +
        '2026-11-02,Pengeluaran,Makan,288000,GoPay,,"Nasi, ""padang""\nenak",AI\r\n' +
        "2026-11-03,Transfer,,100000,GoPay,Dana Darurat,'=1+1,Manual\r\n" +
        '2026-11-04,Penyesuaian,,-2500,GoPay,,,Impor\r\n',
    );
    expect(mockFilter).toEqual([]);
  });

  it('rentang bulan ini hanya menyaring transaksi', async () => {
    await susunEkspor('xlsx', 'bulan', 'Asia/Jakarta', SEKARANG);
    expect(mockFilter).toEqual([
      { tabel: 'transactions', op: 'gte', kolom: 'tanggal', nilai: '2026-11-01' },
      { tabel: 'transactions', op: 'lte', kolom: 'tanggal', nilai: '2026-11-30' },
    ]);
  });

  it('XLSX: satu sheet per sumber, nominal sebagai <v>', async () => {
    const b = await susunEkspor('xlsx', 'semua', 'Asia/Jakarta', SEKARANG);
    expect(b.mime).toBe(MIME_XLSX);
    const e = entriZip(b.isi as Uint8Array);
    expect(e['xl/workbook.xml']).toContain('<sheet name="Transaksi" sheetId="1" r:id="rId1"/>');
    expect(e['xl/workbook.xml']).toContain('<sheet name="Dompet"');
    expect(e['xl/workbook.xml']).toContain('<sheet name="Kategori"');
    expect(Object.keys(e).filter((n) => n.startsWith('xl/worksheets/'))).toHaveLength(SUMBER_EKSPOR.length);
    const s1 = e['xl/worksheets/sheet1.xml'];
    expect(s1).toContain('<c r="D2"><v>288000</v></c>');
    expect(s1).toContain('<c r="D3"><v>100000</v></c>');
    expect(s1).toContain('<c r="D4"><v>-2500</v></c>');
    expect(s1).toContain('<c r="F3" t="inlineStr"><is><t xml:space="preserve">Dana Darurat</t></is></c>');
    expect(s1).not.toContain('r="F4"');
    expect(s1).toContain('Nasi, &quot;padang&quot;\nenak');
    const s2 = e['xl/worksheets/sheet2.xml'];
    expect(s2).toContain('<c r="C3"><v>0</v></c>');
    expect(s2).toContain('<c r="E3"><v>9000000</v></c>');
    expect(s2).toContain('<t xml:space="preserve">Ya</t>');
  });
});

describe('jalankanEkspor', () => {
  it('menulis ke cache lalu membagikan dengan mime xlsx', async () => {
    await jalankanEkspor('xlsx', 'semua');
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/arta-ekspor-\d{4}-\d{2}-\d{2}\.xlsx$/),
      expect.objectContaining({ mimeType: MIME_XLSX, dialogTitle: 'Ekspor data arta' }),
    );
  });

  it('berbagi tidak tersedia -> galat ramah, tidak menulis berkas', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(jalankanEkspor('csv', 'semua')).rejects.toMatchObject({ kind: 'lain' });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

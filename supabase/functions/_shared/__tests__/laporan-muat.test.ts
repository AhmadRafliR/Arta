import { createHmac, webcrypto } from 'crypto';
import {
  buatTandatanganHmac,
  klaimBulanan,
  muatAksesIklan,
  muatDataLaporan,
  muatKandidat,
  muatPenerima,
  muatPro,
  selesaiBulanan,
  UKURAN_HALAMAN,
  type HasilSb,
  type KueriSb,
  type SbLike,
} from '../laporan/muat';

type Op = [string, ...unknown[]];
type Panggilan = { tabel: string; ops: Op[] };
type Jawab = (p: Panggilan) => HasilSb | Promise<HasilSb>;

// SbLike palsu: merekam setiap rantai panggilan per tabel, jawaban ditentukan oleh `jawab`.
function buatSb(jawab: Jawab) {
  const log: Panggilan[] = [];
  const kueri = (p: Panggilan): KueriSb => {
    const lanjut = (op: Op) => {
      p.ops.push(op);
      return kueri(p);
    };
    const selesai = (op: Op) => {
      p.ops.push(op);
      return Promise.resolve().then(() => jawab(p));
    };
    return {
      select: (k) => lanjut(['select', k]),
      eq: (k, v) => lanjut(['eq', k, v]),
      in: (k, v) => lanjut(['in', k, v]),
      order: (k, o) => lanjut(['order', k, o]),
      range: (a, b) => lanjut(['range', a, b]),
      single: () => selesai(['single']),
      maybeSingle: () => selesai(['maybeSingle']),
      then: (ok, gagal) => Promise.resolve().then(() => jawab(p)).then(ok, gagal),
    };
  };
  const sb: SbLike = {
    from: (tabel) => {
      const mulai = (op: Op) => {
        const p: Panggilan = { tabel, ops: [op] };
        log.push(p);
        return kueri(p);
      };
      return {
        select: (k) => mulai(['select', k]),
        insert: (b) => mulai(['insert', b]),
        update: (b) => mulai(['update', b]),
      };
    },
  };
  return { sb, log };
}

const ok = (data: unknown): HasilSb => ({ data, error: null, status: 200 });
const rangeDari = (p: Panggilan) => p.ops.find((o) => o[0] === 'range') as [string, number, number] | undefined;

const UID = 'user-a';

function jawabanDasar(opsi: { txTotal?: number; hutang?: 'galat' | 'lempar' | unknown[] } = {}): Jawab {
  const txTotal = opsi.txTotal ?? 2;
  return (p) => {
    switch (p.tabel) {
      case 'profiles':
        return ok({ nama: ' Rafli ', zona_waktu: 'Asia/Makassar' });
      case 'wallets':
        return ok([
          { id: 'w1', nama: 'GoPay', tipe: null, saldo_awal: '152000', target: null, diarsip: null },
          { id: 'w2', nama: 'Darurat', tipe: 'darurat', saldo_awal: 0, target: 3000000, diarsip: false },
        ]);
      case 'transactions': {
        const [, dari, sampai] = rangeDari(p)!;
        const baris = [];
        for (let i = dari; i <= Math.min(sampai, txTotal - 1); i++) {
          baris.push({
            id: `t${i}`,
            tanggal: '2026-11-01',
            jenis: 'pengeluaran',
            kategori: 'makan',
            nominal: '1000',
            wallet_id: 'w1',
            wallet_tujuan_id: null,
            catatan: null,
          });
        }
        return ok(baris);
      }
      case 'budgets':
        return ok([{ kategori: 'makan', batas_bulanan: '800000' }]);
      case 'v_hutang':
        if (opsi.hutang === 'galat') return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
        if (opsi.hutang === 'lempar') throw new Error('jaringan');
        return ok(opsi.hutang ?? [
          { pemberi: 'Kredivo', sisa_pokok: '1200000', jatuh_tempo_berikutnya: '2026-12-05', nominal_berikutnya: 300000, diarsip: false },
        ]);
      default:
        return { data: null, error: { code: 'X', message: `tabel ${p.tabel}` } };
    }
  };
}

describe('muatDataLaporan', () => {
  it('menyaring user_id di setiap tabel (profiles lewat id) dan memetakan angka', async () => {
    const { sb, log } = buatSb(jawabanDasar());
    const d = await muatDataLaporan(sb, UID);

    for (const p of log) {
      const kunci = p.tabel === 'profiles' ? 'id' : 'user_id';
      expect(p.ops).toContainEqual(['eq', kunci, UID]);
    }
    expect(new Set(log.map((p) => p.tabel))).toEqual(
      new Set(['profiles', 'wallets', 'transactions', 'budgets', 'v_hutang']),
    );
    expect(d.nama).toBe('Rafli');
    expect(d.zona).toBe('Asia/Makassar');
    expect(d.wallets[0]).toEqual({ id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 152000, target: null, diarsip: false });
    expect(d.txs[0].nominal).toBe(1000);
    expect(d.budgets).toEqual([{ kategori: 'makan', batas_bulanan: 800000 }]);
    expect(d.hutang).toEqual([
      { pemberi: 'Kredivo', sisa_pokok: 1200000, jatuh_tempo_berikutnya: '2026-12-05', nominal_berikutnya: 300000, diarsip: false },
    ]);
  });

  it('transaksi diambil berhalaman 1000 sampai habis', async () => {
    const total = UKURAN_HALAMAN * 2 + 5;
    const { sb, log } = buatSb(jawabanDasar({ txTotal: total }));
    const d = await muatDataLaporan(sb, UID);
    expect(d.txs).toHaveLength(total);
    const halaman = log.filter((p) => p.tabel === 'transactions').map((p) => rangeDari(p)!.slice(1));
    expect(halaman).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('tepat 1000 baris → satu halaman kosong tambahan, lalu berhenti', async () => {
    const { sb, log } = buatSb(jawabanDasar({ txTotal: UKURAN_HALAMAN }));
    const d = await muatDataLaporan(sb, UID);
    expect(d.txs).toHaveLength(UKURAN_HALAMAN);
    expect(log.filter((p) => p.tabel === 'transactions')).toHaveLength(2);
  });

  it('v_hutang galat atau melempar → hutang null', async () => {
    const a = await muatDataLaporan(buatSb(jawabanDasar({ hutang: 'galat' })).sb, UID);
    expect(a.hutang).toBeNull();
    const b = await muatDataLaporan(buatSb(jawabanDasar({ hutang: 'lempar' })).sb, UID);
    expect(b.hutang).toBeNull();
  });

  it('profil kosong → nama null, zona Asia/Jakarta', async () => {
    const dasar = jawabanDasar();
    const { sb } = buatSb((p) => (p.tabel === 'profiles' ? ok(null) : dasar(p)));
    const d = await muatDataLaporan(sb, UID);
    expect(d.nama).toBeNull();
    expect(d.zona).toBe('Asia/Jakarta');
  });

  it('galat tabel lain → dilempar', async () => {
    const dasar = jawabanDasar();
    const { sb } = buatSb((p) => (p.tabel === 'wallets' ? { data: null, error: { code: '500' } } : dasar(p)));
    await expect(muatDataLaporan(sb, UID)).rejects.toThrow();
  });
});

describe('muatPenerima & muatPro', () => {
  it('penerima menyaring user_id', async () => {
    const { sb, log } = buatSb(() => ok([{ id: 'r1', email: 'a@example.com', terverifikasi: true }]));
    expect(await muatPenerima(sb, UID)).toEqual([{ id: 'r1', email: 'a@example.com', terverifikasi: true }]);
    expect(log[0].ops).toContainEqual(['eq', 'user_id', UID]);
  });

  it('pro: aktif tanpa batas, kedaluwarsa, tanpa baris', async () => {
    const sekarang = new Date('2026-11-20T00:00:00Z');
    const cek = (data: unknown) => muatPro(buatSb(() => ok(data)).sb, UID, sekarang);
    expect(await cek({ pro_aktif: true, berlaku_sampai: null })).toBe(true);
    expect(await cek({ pro_aktif: true, berlaku_sampai: '2026-12-01T00:00:00Z' })).toBe(true);
    expect(await cek({ pro_aktif: true, berlaku_sampai: '2026-11-01T00:00:00Z' })).toBe(false);
    expect(await cek({ pro_aktif: false, berlaku_sampai: null })).toBe(false);
    expect(await cek(null)).toBe(false);
  });
});

describe('muatAksesIklan', () => {
  it('berlaku hanya bila berlaku_sampai di masa depan, dan menyaring user & fitur', async () => {
    const sekarang = new Date('2026-11-21T10:00:00Z');
    const cek = (data: unknown) => {
      const { sb, log } = buatSb(() => ok(data));
      return muatAksesIklan(sb, UID, 'laporan', sekarang).then((v) => ({ v, log }));
    };
    const a = await cek({ berlaku_sampai: '2026-11-21T10:20:00Z' });
    expect(a.v).toBe(true);
    expect(a.log[0].tabel).toBe('akses_iklan');
    expect(a.log[0].ops).toContainEqual(['eq', 'user_id', UID]);
    expect(a.log[0].ops).toContainEqual(['eq', 'fitur', 'laporan']);
    expect((await cek({ berlaku_sampai: '2026-11-21T09:59:00Z' })).v).toBe(false);
    expect((await cek({ berlaku_sampai: null })).v).toBe(false);
    expect((await cek(null)).v).toBe(false);
  });
});

describe('muatKandidat', () => {
  it('Pro berlaku ∩ penerima terverifikasi, zona dari profiles', async () => {
    const { sb, log } = buatSb((p) => {
      if (p.tabel === 'entitlements') {
        return ok([
          { user_id: 'a', pro_aktif: true, berlaku_sampai: null },
          { user_id: 'b', pro_aktif: true, berlaku_sampai: '2026-01-01T00:00:00Z' },
          { user_id: 'c', pro_aktif: true, berlaku_sampai: '2027-01-01T00:00:00Z' },
          { user_id: 'd', pro_aktif: true, berlaku_sampai: null },
        ]);
      }
      if (p.tabel === 'report_recipients') return ok([{ user_id: 'a' }, { user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }]);
      if (p.tabel === 'profiles') return ok([{ id: 'a', zona_waktu: 'Asia/Jayapura' }, { id: 'c', zona_waktu: null }]);
      return { data: null, error: { code: 'X' } };
    });
    expect(await muatKandidat(sb, new Date('2026-11-20T00:00:00Z'))).toEqual([
      { userId: 'a', zona: 'Asia/Jayapura' },
      { userId: 'c', zona: 'Asia/Jakarta' },
    ]);
    expect(log.find((p) => p.tabel === 'entitlements')!.ops).toContainEqual(['eq', 'pro_aktif', true]);
    expect(log.find((p) => p.tabel === 'report_recipients')!.ops).toContainEqual(['eq', 'terverifikasi', true]);
    expect(log.find((p) => p.tabel === 'profiles')!.ops).toContainEqual(['in', 'id', ['a', 'c']]);
  });

  it('tanpa Pro → [] tanpa membaca penerima', async () => {
    const { sb, log } = buatSb(() => ok([]));
    expect(await muatKandidat(sb, new Date())).toEqual([]);
    expect(log.map((p) => p.tabel)).toEqual(['entitlements']);
  });
});

describe('klaimBulanan & selesaiBulanan', () => {
  it('insert report_log bulanan → id', async () => {
    const { sb, log } = buatSb(() => ok({ id: 'log-1' }));
    expect(await klaimBulanan(sb, UID, '2026-11')).toBe('log-1');
    expect(log[0].tabel).toBe('report_log');
    expect(log[0].ops[0]).toEqual(['insert', { user_id: UID, bulan: '2026-11', jenis: 'bulanan' }]);
  });

  it('23505 → null; galat lain dilempar', async () => {
    const dobel = buatSb(() => ({ data: null, error: { code: '23505', message: 'duplicate key' } }));
    expect(await klaimBulanan(dobel.sb, UID, '2026-11')).toBeNull();
    const rusak = buatSb(() => ({ data: null, error: { code: '42501' } }));
    await expect(klaimBulanan(rusak.sb, UID, '2026-11')).rejects.toThrow();
  });

  it('selesai memperbarui status dan jumlah', async () => {
    const { sb, log } = buatSb(() => ok(null));
    await selesaiBulanan(sb, 'log-1', 'terkirim', 2);
    expect(log[0].ops).toEqual([
      ['update', { status: 'terkirim', jumlah_penerima: 2 }],
      ['eq', 'id', 'log-1'],
    ]);
  });
});

describe('buatTandatanganHmac', () => {
  const subtle = webcrypto.subtle as unknown as Parameters<typeof buatTandatanganHmac>[1];

  it('HMAC-SHA256 base64url tanpa padding, sama dengan node:crypto', async () => {
    const ttd = buatTandatanganHmac('rahasia-uji', subtle);
    const pesan = 'verif.rec-1.ibu@example.com.1800000000';
    const harapan = createHmac('sha256', 'rahasia-uji').update(pesan).digest('base64url');
    const sig = await ttd(pesan);
    expect(sig).toBe(harapan);
    expect(sig).not.toMatch(/[=+/]/);
    expect(await ttd(pesan)).toBe(sig);
  });

  it('rahasia kosong → galat saat dipakai, bukan saat dibuat', async () => {
    const ttd = buatTandatanganHmac('', subtle);
    await expect(ttd('x')).rejects.toThrow('LAPORAN_SECRET');
  });
});

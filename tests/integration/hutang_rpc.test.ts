import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser, uuidV4 } from './helpers';

afterAll(cleanupUsers);

type Item = Record<string, unknown>;

const item = (over: Item): Item => ({
  id: uuidV4(),
  tanggal: '2026-11-20',
  jenis: 'pengeluaran',
  kategori: null,
  nominal: 15000,
  wallet_id: null,
  wallet_tujuan_id: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
  ...over,
});

async function bikinDompet(client: SupabaseClient, nama = 'Tunai'): Promise<string> {
  const { data, error } = await client.from('wallets').insert({ nama }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

async function simpan(client: SupabaseClient, items: Item[]) {
  return client.rpc('save_transactions', { items });
}

async function simpanOk(client: SupabaseClient, items: Item[]) {
  const { data, error } = await simpan(client, items);
  expect(error).toBeNull();
  return data as Record<string, unknown>[];
}

const itemCicilan = (debtId: string, over: Item = {}): Item =>
  item({
    jenis: 'hutang_baru',
    kategori: 'Kredivo',
    nominal: 1200000,
    debt_id: debtId,
    hutang: {
      pemberi: 'Kredivo',
      tipe: 'cicilan_tetap',
      tanggal_mulai: '2026-11-20',
      nominal_cicilan: 100000,
      tenor_bulan: 12,
      jatuh_tempo_pertama: '2026-12-05',
    },
    ...over,
  });

const itemBerbunga = (debtId: string, hutang: Item = {}, over: Item = {}): Item =>
  item({
    jenis: 'hutang_baru',
    tanggal: '2026-11-01',
    kategori: 'Pinjaman Andi',
    nominal: 1000000,
    debt_id: debtId,
    hutang: {
      pemberi: 'Pinjaman Andi',
      tipe: 'berbunga',
      tanggal_mulai: '2026-11-01',
      pokok_awal: 1000000,
      bunga_persen_bulanan: 2,
      metode: 'flat',
      ...hutang,
    },
    ...over,
  });

async function buatCicilan(client: SupabaseClient): Promise<string> {
  const debtId = uuidV4();
  await simpanOk(client, [itemCicilan(debtId)]);
  return debtId;
}

async function buatBerbunga(client: SupabaseClient, hutang: Item = {}): Promise<string> {
  const debtId = uuidV4();
  await simpanOk(client, [itemBerbunga(debtId, hutang)]);
  return debtId;
}

async function bayar(
  client: SupabaseClient,
  debtId: string,
  wallet: string,
  nominal: number,
  tanggal = '2026-11-20',
): Promise<string> {
  const it = item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: wallet, nominal, tanggal });
  await simpanOk(client, [it]);
  return it.id as string;
}

async function porsi(client: SupabaseClient, txId: string) {
  const { data, error } = await client
    .from('transactions')
    .select('porsi_bunga, porsi_pokok')
    .eq('id', txId)
    .single();
  expect(error).toBeNull();
  return { bunga: Number(data!.porsi_bunga), pokok: Number(data!.porsi_pokok) };
}

async function ringkas(client: SupabaseClient, debtId: string) {
  const { data, error } = await client.from('v_hutang').select('*').eq('id', debtId).single();
  expect(error).toBeNull();
  return data as Record<string, unknown>;
}

async function jadwal(client: SupabaseClient, debtId: string) {
  const { data, error } = await client
    .from('debt_schedule')
    .select('*')
    .eq('debt_id', debtId)
    .order('jatuh_tempo');
  expect(error).toBeNull();
  return data as { jatuh_tempo: string; nominal: number; status: string; transaction_id: string | null }[];
}

async function hitungTx(client: SupabaseClient, filter: Record<string, string>) {
  let q = client.from('transactions').select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count, error } = await q;
  expect(error).toBeNull();
  return count;
}

test('hutang_baru cicilan tetap tanpa dompet: pokok, 12 tagihan, saldo dompet tetap', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = uuidV4();
  const data = await simpanOk(a.client, [itemCicilan(debtId)]);
  expect(data).toHaveLength(1);
  expect(data[0].wallet_id).toBeNull();
  expect(data[0].debt_id).toBe(debtId);
  expect(data[0].kategori).toBe('Kredivo');

  const { data: d } = await a.client.from('debts').select('*').eq('id', debtId).single();
  expect(Number(d.pokok_awal)).toBe(1200000);
  expect(d.tipe).toBe('cicilan_tetap');
  expect(d.metode).toBeNull();

  const j = await jadwal(a.client, debtId);
  expect(j).toHaveLength(12);
  expect(j[0].jatuh_tempo).toBe('2026-12-05');
  expect(j[11].jatuh_tempo).toBe('2027-11-05');
  expect(j.every((t) => Number(t.nominal) === 100000 && t.status === 'belum')).toBe(true);

  expect(await hitungTx(a.client, { wallet_id: w })).toBe(0);

  const r = await ringkas(a.client, debtId);
  expect(Number(r.sisa_pokok)).toBe(1200000);
  expect(Number(r.jumlah_tagihan)).toBe(12);
  expect(r.jatuh_tempo_berikutnya).toBe('2026-12-05');
  expect(Number(r.nominal_berikutnya)).toBe(100000);
  expect(r.jatuh_tempo_terakhir).toBe('2027-11-05');
});

test('jadwal akhir bulan mengikuti Postgres (31 Jan + 1 bulan = 28 Feb)', async () => {
  const a = await createTestUser();
  const debtId = uuidV4();
  const it = itemCicilan(debtId);
  (it.hutang as Item).jatuh_tempo_pertama = '2027-01-31';
  (it.hutang as Item).tenor_bulan = 3;
  it.nominal = 300000;
  await simpanOk(a.client, [it]);
  const j = await jadwal(a.client, debtId);
  expect(j.map((t) => t.jatuh_tempo)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
});

test('hutang_baru dengan dompet: transaksi masuk ke dompet itu', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = uuidV4();
  const data = await simpanOk(a.client, [itemBerbunga(debtId, {}, { wallet_id: w })]);
  expect(data[0].wallet_id).toBe(w);
  expect(await hitungTx(a.client, { wallet_id: w })).toBe(1);
});

test('simpan ulang item yang sama: tetap 1 hutang, 12 tagihan, 1 transaksi', async () => {
  const a = await createTestUser();
  const debtId = uuidV4();
  const it = itemCicilan(debtId);
  await simpanOk(a.client, [it]);
  const r2 = await simpanOk(a.client, [it]);
  expect(r2).toEqual([]);

  const { count: nDebts } = await a.client
    .from('debts')
    .select('*', { count: 'exact', head: true });
  expect(nDebts).toBe(1);
  expect(await jadwal(a.client, debtId)).toHaveLength(12);
  expect(await hitungTx(a.client, { debt_id: debtId })).toBe(1);
});

test('bayar cicilan: tagihan lunas berurutan sesuai kumulatif', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatCicilan(a.client);

  const it1 = item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: w, nominal: 100000 });
  const data = await simpanOk(a.client, [it1]);
  expect(data[0].kategori).toBe('Kredivo');
  expect(Number(data[0].porsi_bunga)).toBe(0);
  expect(Number(data[0].porsi_pokok)).toBe(100000);

  let j = await jadwal(a.client, debtId);
  expect(j[0].status).toBe('lunas');
  expect(j[0].transaction_id).toBe(it1.id);
  expect(j[1].status).toBe('belum');

  let r = await ringkas(a.client, debtId);
  expect(Number(r.sisa_pokok)).toBe(1100000);
  expect(Number(r.tagihan_lunas)).toBe(1);
  expect(Number(r.total_bayar)).toBe(100000);
  expect(r.bayar_terakhir).toBe('2026-11-20');

  const tx2 = await bayar(a.client, debtId, w, 250000, '2026-11-21');
  j = await jadwal(a.client, debtId);
  expect(j[1].status).toBe('lunas');
  expect(j[1].transaction_id).toBe(tx2);
  expect(j[2].status).toBe('lunas');
  expect(j[2].transaction_id).toBe(tx2);
  expect(j[3].status).toBe('belum');
  expect(j[3].transaction_id).toBeNull();

  r = await ringkas(a.client, debtId);
  expect(Number(r.sisa_pokok)).toBe(850000);
  expect(Number(r.tagihan_lunas)).toBe(3);
  expect(r.jatuh_tempo_berikutnya).toBe('2027-03-05');
});

test('hapus pembayaran cicilan: status tagihan kembali belum', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatCicilan(a.client);
  const tx = await bayar(a.client, debtId, w, 100000);
  expect((await jadwal(a.client, debtId))[0].status).toBe('lunas');

  const del = await a.client.from('transactions').delete().eq('id', tx);
  expect(del.error).toBeNull();

  const j = await jadwal(a.client, debtId);
  expect(j[0].status).toBe('belum');
  expect(j[0].transaction_id).toBeNull();
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(1200000);
});

test('bunga flat: hanya pembayaran pertama per bulan membawa bunga', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'flat' });

  const t1 = await bayar(a.client, debtId, w, 300000, '2026-11-10');
  expect(await porsi(a.client, t1)).toEqual({ bunga: 20000, pokok: 280000 });

  const t2 = await bayar(a.client, debtId, w, 100000, '2026-11-25');
  expect(await porsi(a.client, t2)).toEqual({ bunga: 0, pokok: 100000 });

  const t3 = await bayar(a.client, debtId, w, 50000, '2026-12-03');
  expect(await porsi(a.client, t3)).toEqual({ bunga: 20000, pokok: 30000 });

  const r = await ringkas(a.client, debtId);
  expect(Number(r.sisa_pokok)).toBe(590000);
  expect(Number(r.total_bunga)).toBe(40000);
  expect(Number(r.total_bayar)).toBe(450000);
});

test('respons RPC hutang_bayar sudah berisi porsi hasil hitung server', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client);
  const data = await simpanOk(a.client, [
    item({
      jenis: 'hutang_bayar',
      debt_id: debtId,
      wallet_id: w,
      nominal: 300000,
      tanggal: '2026-11-10',
      porsi_bunga: 1,
      porsi_pokok: 1,
    }),
  ]);
  expect(Number(data[0].porsi_bunga)).toBe(20000);
  expect(Number(data[0].porsi_pokok)).toBe(280000);
  expect(data[0].kategori).toBe('Pinjaman Andi');
});

test('bunga efektif dihitung dari sisa pokok sebelum bayar', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'efektif' });

  const t1 = await bayar(a.client, debtId, w, 300000, '2026-11-10');
  expect(await porsi(a.client, t1)).toEqual({ bunga: 20000, pokok: 280000 });

  const t2 = await bayar(a.client, debtId, w, 300000, '2026-12-10');
  expect(await porsi(a.client, t2)).toEqual({ bunga: 14400, pokok: 285600 });
});

test('bunga tidak menumpuk: kurang bayar dan bulan terlewat tetap satu kali bunga', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'flat' });

  const t1 = await bayar(a.client, debtId, w, 10000, '2026-11-10');
  expect(await porsi(a.client, t1)).toEqual({ bunga: 10000, pokok: 0 });

  // Desember tidak bayar; Januari hanya satu kali bunga 20.000.
  const t2 = await bayar(a.client, debtId, w, 100000, '2027-01-10');
  expect(await porsi(a.client, t2)).toEqual({ bunga: 20000, pokok: 80000 });
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(920000);
});

test('hapus pembayaran lama: pembayaran sesudahnya dihitung ulang', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'efektif' });

  const nov = await bayar(a.client, debtId, w, 300000, '2026-11-10');
  const des = await bayar(a.client, debtId, w, 300000, '2026-12-10');
  expect(await porsi(a.client, des)).toEqual({ bunga: 14400, pokok: 285600 });

  const del = await a.client.from('transactions').delete().eq('id', nov);
  expect(del.error).toBeNull();

  expect(await porsi(a.client, des)).toEqual({ bunga: 20000, pokok: 280000 });
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(720000);
});

test('ubah tanggal pembayaran: pecahan dihitung ulang', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'flat' });

  const t1 = await bayar(a.client, debtId, w, 300000, '2026-11-10');
  const t2 = await bayar(a.client, debtId, w, 100000, '2026-11-25');
  expect(await porsi(a.client, t2)).toEqual({ bunga: 0, pokok: 100000 });

  const up = await a.client.from('transactions').update({ tanggal: '2026-10-25' }).eq('id', t2);
  expect(up.error).toBeNull();

  expect(await porsi(a.client, t2)).toEqual({ bunga: 20000, pokok: 80000 });
  expect(await porsi(a.client, t1)).toEqual({ bunga: 20000, pokok: 280000 });
});

test('ubah bunga hutang: pembayaran dihitung ulang', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'flat' });
  const t1 = await bayar(a.client, debtId, w, 300000, '2026-11-10');

  const up = await a.client.from('debts').update({ bunga_persen_bulanan: 3 }).eq('id', debtId);
  expect(up.error).toBeNull();
  expect(await porsi(a.client, t1)).toEqual({ bunga: 30000, pokok: 270000 });
});

test('lebih bayar ditolak dan tidak ada baris yang tersimpan', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatCicilan(a.client);

  const lain = item({ wallet_id: w, kategori: 'makan' });
  const lebih = item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: w, nominal: 1300000 });
  const { error } = await simpan(a.client, [lain, lebih]);
  expect(error).not.toBeNull();
  expect(error!.message).toBe('Pembayaran melebihi sisa hutang');

  expect(await hitungTx(a.client, { wallet_id: w })).toBe(0);
  expect((await jadwal(a.client, debtId)).every((t) => t.status === 'belum')).toBe(true);
});

test('lebih bayar berbunga: bunga + sisa pokok adalah batas', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client, { metode: 'flat' });

  const { error } = await simpan(a.client, [
    item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: w, nominal: 1020001, tanggal: '2026-11-10' }),
  ]);
  expect(error!.message).toBe('Pembayaran melebihi sisa hutang');

  const pas = await bayar(a.client, debtId, w, 1020000, '2026-11-10');
  expect(await porsi(a.client, pas)).toEqual({ bunga: 20000, pokok: 1000000 });
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(0);

  // Sudah lunas: bulan berikutnya tidak ada bunga flat, jadi bayar lagi = lebih bayar.
  const lagi = await simpan(a.client, [
    item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: w, nominal: 5000, tanggal: '2026-12-10' }),
  ]);
  expect(lagi.error!.message).toBe('Pembayaran melebihi sisa hutang');
});

test('hutang yang sudah berjalan: penyesuaian awal, bunga flat tetap dari pokok awal', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = uuidV4();
  const it = itemBerbunga(debtId, { metode: 'flat', sisa_pokok_sekarang: 600000 });
  const data = await simpanOk(a.client, [it]);
  expect(data).toHaveLength(2);

  const { data: adj, error } = await a.client
    .from('transactions')
    .select('*')
    .eq('debt_id', debtId)
    .eq('jenis', 'penyesuaian');
  expect(error).toBeNull();
  expect(adj).toHaveLength(1);
  expect(Number(adj![0].nominal)).toBe(400000);
  expect(Number(adj![0].porsi_pokok)).toBe(400000);
  expect(adj![0].wallet_id).toBeNull();
  expect(adj![0].tanggal).toBe('2026-11-01');
  expect(adj![0].catatan).toBe('Sudah dibayar sebelum pakai arta');

  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(600000);

  const t = await bayar(a.client, debtId, w, 100000, '2026-12-05');
  expect(await porsi(a.client, t)).toEqual({ bunga: 20000, pokok: 80000 });

  // Simpan ulang: penyesuaian tidak digandakan.
  expect(await simpanOk(a.client, [it])).toEqual([]);
  expect(await hitungTx(a.client, { debt_id: debtId, jenis: 'penyesuaian' })).toBe(1);
});

test('penyesuaian hutang berbunga lewat RPC mengubah sisa pokok', async () => {
  const a = await createTestUser();
  const debtId = await buatBerbunga(a.client);
  await simpanOk(a.client, [
    item({ jenis: 'penyesuaian', kategori: 'penyesuaian', debt_id: debtId, nominal: 50000 }),
  ]);
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(950000);
  await simpanOk(a.client, [
    item({ jenis: 'penyesuaian', kategori: 'penyesuaian', debt_id: debtId, nominal: -20000 }),
  ]);
  expect(Number((await ringkas(a.client, debtId)).sisa_pokok)).toBe(970000);
});

test('penyesuaian hutang dengan dompet ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client);
  const { error } = await simpan(a.client, [
    item({ jenis: 'penyesuaian', debt_id: debtId, wallet_id: w, nominal: 50000 }),
  ]);
  expect(error!.message).toBe('Penyesuaian hutang tidak memakai dompet');
});

test('bayar hutang yang diarsip ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client);
  const up = await a.client.from('debts').update({ diarsip: true }).eq('id', debtId);
  expect(up.error).toBeNull();

  const { error } = await simpan(a.client, [
    item({ jenis: 'hutang_bayar', debt_id: debtId, wallet_id: w, nominal: 100000 }),
  ]);
  expect(error!.message).toBe('Hutang sudah diarsipkan');

  const adj = await simpan(a.client, [
    item({ jenis: 'penyesuaian', debt_id: debtId, nominal: 1000 }),
  ]);
  expect(adj.error!.message).toBe('Hutang sudah diarsipkan');
  expect(await hitungTx(a.client, { debt_id: debtId, jenis: 'hutang_bayar' })).toBe(0);
});

test('penyesuaian pada cicilan tetap ditolak', async () => {
  const a = await createTestUser();
  const debtId = await buatCicilan(a.client);
  const { error } = await simpan(a.client, [
    item({ jenis: 'penyesuaian', debt_id: debtId, nominal: 100000 }),
  ]);
  expect(error!.message).toBe('Penyesuaian hanya untuk hutang berbunga');
});

test('hutang_bayar ke hutang milik pengguna lain atau tanpa debt_id ditolak', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const wb = await bikinDompet(b.client, 'Punya B');
  const debtA = await buatBerbunga(a.client);

  const r1 = await simpan(b.client, [
    item({ jenis: 'hutang_bayar', debt_id: debtA, wallet_id: wb, nominal: 100000 }),
  ]);
  expect(r1.error!.message).toBe('Hutang tidak ditemukan');

  const r2 = await simpan(b.client, [
    item({ jenis: 'hutang_bayar', wallet_id: wb, nominal: 100000 }),
  ]);
  expect(r2.error!.message).toBe('Hutang tidak ditemukan');

  const r3 = await simpan(a.client, [
    item({ jenis: 'hutang_bayar', debt_id: debtA, nominal: 100000 }),
  ]);
  expect(r3.error!.message).toBe('Dompet wajib diisi');
});

test('validasi hutang_baru', async () => {
  const a = await createTestUser();
  const kasus: [Item, string][] = [
    [{ pemberi: '  ' }, 'Nama pemberi wajib diisi'],
    [{ tenor_bulan: 0 }, 'Tenor 1–60 bulan'],
    [{ tenor_bulan: 61 }, 'Tenor 1–60 bulan'],
    [{ nominal_cicilan: null }, 'Nominal cicilan wajib diisi'],
  ];
  for (const [ubah, pesan] of kasus) {
    const it = itemCicilan(uuidV4());
    it.hutang = { ...(it.hutang as Item), ...ubah };
    const { error } = await simpan(a.client, [it]);
    expect(error?.message).toBe(pesan);
  }

  const kasusBerbunga: [Item, string][] = [
    [{ bunga_persen_bulanan: 101 }, 'Bunga 0–100% per bulan'],
    [{ bunga_persen_bulanan: -1 }, 'Bunga 0–100% per bulan'],
    [{ metode: 'majemuk' }, 'Metode bunga flat atau efektif'],
    [{ sisa_pokok_sekarang: 1000001 }, 'Sisa pokok tidak boleh lebih dari pokok awal'],
  ];
  for (const [ubah, pesan] of kasusBerbunga) {
    const { error } = await simpan(a.client, [itemBerbunga(uuidV4(), ubah)]);
    expect(error?.message).toBe(pesan);
  }

  const { count } = await a.client.from('debts').select('*', { count: 'exact', head: true });
  expect(count).toBe(0);
});

test('bunga desimal disimpan (2,5% per bulan)', async () => {
  const a = await createTestUser();
  const debtId = await buatBerbunga(a.client, { bunga_persen_bulanan: 2.5 });
  const r = await ringkas(a.client, debtId);
  expect(Number(r.bunga_persen_bulanan)).toBe(2.5);
});

test('hapus hutang: semua transaksi dan jadwalnya ikut terhapus', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatCicilan(a.client);
  await bayar(a.client, debtId, w, 100000);
  expect(await hitungTx(a.client, { debt_id: debtId })).toBe(2);

  const del = await a.client.from('debts').delete().eq('id', debtId);
  expect(del.error).toBeNull();

  expect(await hitungTx(a.client, { debt_id: debtId })).toBe(0);
  expect(await hitungTx(a.client, { wallet_id: w })).toBe(0);
  expect(await jadwal(a.client, debtId)).toHaveLength(0);
});

test('tambah_jadwal pada berbunga: status mengikuti total bayar', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client);
  const debtId = await buatBerbunga(a.client);

  const r1 = await a.client.rpc('tambah_jadwal', {
    p_debt: debtId,
    p_jatuh_tempo: '2026-12-10',
    p_nominal: 100000,
  });
  expect(r1.error).toBeNull();
  expect(r1.data.status).toBe('belum');

  const tx = await bayar(a.client, debtId, w, 150000, '2026-12-01');
  let j = await jadwal(a.client, debtId);
  expect(j[0].status).toBe('lunas');
  expect(j[0].transaction_id).toBe(tx);

  const r2 = await a.client.rpc('tambah_jadwal', {
    p_debt: debtId,
    p_jatuh_tempo: '2027-01-10',
    p_nominal: 100000,
  });
  expect(r2.error).toBeNull();
  expect(r2.data.status).toBe('belum');

  // Upsert tanggal yang sama dengan nominal baru -> kumulatif 150.000 cukup.
  const r3 = await a.client.rpc('tambah_jadwal', {
    p_debt: debtId,
    p_jatuh_tempo: '2027-01-10',
    p_nominal: 50000,
  });
  expect(r3.error).toBeNull();
  expect(r3.data.status).toBe('lunas');

  j = await jadwal(a.client, debtId);
  expect(j).toHaveLength(2);
  const r = await ringkas(a.client, debtId);
  expect(Number(r.tagihan_lunas)).toBe(2);
});

test('tambah_jadwal pada cicilan tetap ditolak', async () => {
  const a = await createTestUser();
  const debtId = await buatCicilan(a.client);
  const { error } = await a.client.rpc('tambah_jadwal', {
    p_debt: debtId,
    p_jatuh_tempo: '2026-12-10',
    p_nominal: 100000,
  });
  expect(error).not.toBeNull();
});

test('hitung_ulang_hutang tidak bisa dipanggil langsung oleh klien', async () => {
  const a = await createTestUser();
  const debtId = await buatBerbunga(a.client);
  const { error } = await a.client.rpc('hitung_ulang_hutang', { p_debt: debtId });
  expect(error).not.toBeNull();
});

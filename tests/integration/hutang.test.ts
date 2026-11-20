import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

const berbunga = (over: Record<string, unknown> = {}) => ({
  pemberi: 'Pinjaman Andi',
  tipe: 'berbunga',
  tanggal_mulai: '2026-11-01',
  pokok_awal: 1000000,
  bunga_persen_bulanan: 2,
  metode: 'flat',
  ...over,
});

const cicilan = (over: Record<string, unknown> = {}) => ({
  pemberi: 'Kredivo',
  tipe: 'cicilan_tetap',
  tanggal_mulai: '2026-11-01',
  pokok_awal: 1200000,
  nominal_cicilan: 100000,
  tenor_bulan: 12,
  ...over,
});

async function bikinHutang(client: SupabaseClient, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.from('debts').insert(row).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

async function bikinDompet(client: SupabaseClient, nama: string): Promise<string> {
  const { data, error } = await client.from('wallets').insert({ nama }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

test('pengguna B tidak bisa membaca, mengubah, atau menghapus hutang A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const id = await bikinHutang(a.client, berbunga());

  const sel = await b.client.from('debts').select('*');
  expect(sel.error).toBeNull();
  expect(sel.data).toEqual([]);

  await b.client.from('debts').update({ pemberi: 'Diretas' }).eq('id', id);
  await b.client.from('debts').delete().eq('id', id);

  const { data } = await a.client.from('debts').select('*').eq('id', id);
  expect(data).toHaveLength(1);
  expect(data![0].pemberi).toBe('Pinjaman Andi');
});

test('pengguna B tidak bisa memindahkan hutangnya ke user_id A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const id = await bikinHutang(b.client, berbunga());
  const { error } = await b.client.from('debts').update({ user_id: a.userId }).eq('id', id);
  expect(error).not.toBeNull();
});

test('pengguna B tidak bisa merujuk hutang A dari transaksi atau jadwal', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const debtA = await bikinHutang(a.client, berbunga());
  const wb = await bikinDompet(b.client, 'Punya B');

  const tx = await b.client.from('transactions').insert({
    tanggal: '2026-11-20',
    jenis: 'hutang_bayar',
    nominal: 100000,
    wallet_id: wb,
    debt_id: debtA,
  });
  expect(tx.error).not.toBeNull();

  const jadwal = await b.client
    .from('debt_schedule')
    .insert({ debt_id: debtA, jatuh_tempo: '2026-12-05', nominal: 100000 });
  expect(jadwal.error).not.toBeNull();

  const { count } = await a.client
    .from('debt_schedule')
    .select('*', { count: 'exact', head: true });
  expect(count).toBe(0);
});

test('check per tipe hutang', async () => {
  const a = await createTestUser();

  const cicilanMetode = await a.client.from('debts').insert(cicilan({ metode: 'flat' }));
  expect(cicilanMetode.error).not.toBeNull();

  const berbungaTanpaMetode = await a.client.from('debts').insert(berbunga({ metode: null }));
  expect(berbungaTanpaMetode.error).not.toBeNull();

  const cicilanTanpaTenor = await a.client.from('debts').insert(cicilan({ tenor_bulan: null }));
  expect(cicilanTanpaTenor.error).not.toBeNull();

  const tenorKelamaan = await a.client
    .from('debts')
    .insert(cicilan({ tenor_bulan: 61, pokok_awal: 6100000 }));
  expect(tenorKelamaan.error).not.toBeNull();

  const bungaKebanyakan = await a.client
    .from('debts')
    .insert(berbunga({ bunga_persen_bulanan: 101 }));
  expect(bungaKebanyakan.error).not.toBeNull();

  const pemberiKosong = await a.client.from('debts').insert(berbunga({ pemberi: '   ' }));
  expect(pemberiKosong.error).not.toBeNull();

  const ok1 = await a.client.from('debts').insert(cicilan());
  expect(ok1.error).toBeNull();
  const ok2 = await a.client.from('debts').insert(berbunga());
  expect(ok2.error).toBeNull();
});

test('hutang_bayar tanpa debt_id atau tanpa dompet ditolak constraint', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const debt = await bikinHutang(a.client, berbunga());

  const tanpaDebt = await a.client
    .from('transactions')
    .insert({ tanggal: '2026-11-20', jenis: 'hutang_bayar', nominal: 100000, wallet_id: w });
  expect(tanpaDebt.error).not.toBeNull();

  const tanpaDompet = await a.client
    .from('transactions')
    .insert({ tanggal: '2026-11-20', jenis: 'hutang_bayar', nominal: 100000, debt_id: debt });
  expect(tanpaDompet.error).not.toBeNull();

  const pengeluaranDenganDebt = await a.client.from('transactions').insert({
    tanggal: '2026-11-20',
    jenis: 'pengeluaran',
    nominal: 100000,
    wallet_id: w,
    debt_id: debt,
  });
  expect(pengeluaranDenganDebt.error).not.toBeNull();
});

test('v_hutang hanya baris milik sendiri, sisa_pokok = pokok_awal tanpa pembayaran', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const id = await bikinHutang(a.client, berbunga());
  await bikinHutang(b.client, cicilan());

  const { data, error } = await a.client.from('v_hutang').select('*');
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  const row = data![0];
  expect(row.id).toBe(id);
  expect(Number(row.sisa_pokok)).toBe(1000000);
  expect(Number(row.total_bunga)).toBe(0);
  expect(Number(row.total_bayar)).toBe(0);
  expect(Number(row.jumlah_tagihan)).toBe(0);
  expect(Number(row.tagihan_lunas)).toBe(0);
  expect(row.jatuh_tempo_berikutnya).toBeNull();
  expect(row.nominal_berikutnya).toBeNull();
  expect(row.bayar_terakhir).toBeNull();
});

test('anon tidak bisa membaca debts', async () => {
  const u = new URL(process.env.SUPABASE_URL as string).origin;
  const anon = createClient(u, process.env.SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false },
  });
  const { error } = await anon.from('debts').select('*');
  expect(error).not.toBeNull();
  expect(`${error!.code} ${error!.message}`).toMatch(/42501|permission denied/i);
});

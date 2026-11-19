import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

async function bikinDompet(client: SupabaseClient, nama: string): Promise<string> {
  const { data, error } = await client.from('wallets').insert({ nama }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}

const item = (over: Record<string, unknown>) => ({
  id: randomUUID(),
  tanggal: '2026-11-19',
  jenis: 'pengeluaran',
  kategori: 'makan',
  nominal: 15000,
  wallet_id: null,
  wallet_tujuan_id: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
  ...over,
});

const hitung = async (client: SupabaseClient) => {
  const { count, error } = await client
    .from('transactions')
    .select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return count;
};

test('menyimpan 2 item sekaligus', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { data, error } = await a.client.rpc('save_transactions', {
    items: [
      item({ wallet_id: w }),
      item({ wallet_id: w, jenis: 'pemasukan', kategori: 'gaji', nominal: 50000 }),
    ],
  });
  expect(error).toBeNull();
  expect(data).toHaveLength(2);
  expect(await hitung(a.client)).toBe(2);
});

test('id sama dikirim dua kali -> tetap 1 baris', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const it = item({ wallet_id: w });
  const r1 = await a.client.rpc('save_transactions', { items: [it] });
  expect(r1.error).toBeNull();
  expect(r1.data).toHaveLength(1);
  const r2 = await a.client.rpc('save_transactions', { items: [it] });
  expect(r2.error).toBeNull();
  expect(r2.data).toEqual([]);
  expect(await hitung(a.client)).toBe(1);
});

test('transfer ke dompet yang sama ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ jenis: 'transfer', kategori: null, wallet_id: w, wallet_tujuan_id: w })],
  });
  expect(error).not.toBeNull();
  expect(error!.message).toMatch(/dompet tujuan/i);
});

test('transfer tanpa dompet tujuan ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ jenis: 'transfer', kategori: null, wallet_id: w })],
  });
  expect(error!.message).toMatch(/dompet tujuan/i);
});

test('transfer ke dompet milik pengguna lain ditolak', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const wa = await bikinDompet(a.client, 'Tunai');
  const wb = await bikinDompet(b.client, 'Punya B');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ jenis: 'transfer', kategori: null, wallet_id: wa, wallet_tujuan_id: wb })],
  });
  expect(error).not.toBeNull();
  expect(error!.message).toMatch(/dompet tujuan/i);
  expect(await hitung(a.client)).toBe(0);
});

test('wallet_id milik pengguna lain atau kosong ditolak', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const wb = await bikinDompet(b.client, 'Punya B');
  const r1 = await a.client.rpc('save_transactions', { items: [item({ wallet_id: wb })] });
  expect(r1.error!.message).toMatch(/dompet tidak ditemukan/i);
  const r2 = await a.client.rpc('save_transactions', { items: [item({ wallet_id: null })] });
  expect(r2.error!.message).toMatch(/dompet wajib diisi/i);
  expect(await hitung(a.client)).toBe(0);
});

test('satu item tidak valid -> tidak ada yang tersimpan', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ wallet_id: w }), item({ wallet_id: randomUUID() })],
  });
  expect(error!.message).toMatch(/dompet tidak ditemukan/i);
  expect(await hitung(a.client)).toBe(0);
});

test('jenis hutang ditolak: belum didukung', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  for (const jenis of ['hutang_baru', 'hutang_bayar']) {
    const { error } = await a.client.rpc('save_transactions', {
      items: [item({ jenis, wallet_id: w })],
    });
    expect(error!.message).toMatch(/belum didukung/i);
  }
});

test('user_id kiriman klien diabaikan', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { data, error } = await a.client.rpc('save_transactions', {
    items: [item({ wallet_id: w, user_id: b.userId })],
  });
  expect(error).toBeNull();
  expect(data[0].user_id).toBe(a.userId);
});

test('anon tidak boleh memanggil', async () => {
  const u = new URL(process.env.SUPABASE_URL as string).origin;
  const anon = createClient(u, process.env.SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false },
  });
  const { error } = await anon.rpc('save_transactions', { items: [] });
  expect(error).not.toBeNull();
  expect(`${error!.code} ${error!.message}`).toMatch(/42501|permission denied/i);
});

test('non-transfer dengan wallet_tujuan_id ditolak', async () => {
  const a = await createTestUser();
  const w1 = await bikinDompet(a.client, 'Tunai');
  const w2 = await bikinDompet(a.client, 'Bank');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ wallet_id: w1, wallet_tujuan_id: w2 })],
  });
  expect(error!.message).toMatch(/hanya untuk transfer/i);
  expect(await hitung(a.client)).toBe(0);
});

test('item tanpa id ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ wallet_id: w, id: null })],
  });
  expect(error!.message).toMatch(/id transaksi wajib diisi/i);
  expect(await hitung(a.client)).toBe(0);
});

test('id ganda dalam satu permintaan ditolak', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const id = randomUUID();
  const { error } = await a.client.rpc('save_transactions', {
    items: [item({ wallet_id: w, id }), item({ wallet_id: w, id })],
  });
  expect(error!.message).toMatch(/id transaksi ganda/i);
  expect(await hitung(a.client)).toBe(0);
});

test('retry campuran: hanya item baru yang dikembalikan', async () => {
  const a = await createTestUser();
  const w = await bikinDompet(a.client, 'Tunai');
  const lama = item({ wallet_id: w });
  const baru = item({ wallet_id: w, nominal: 777 });
  const r1 = await a.client.rpc('save_transactions', { items: [lama] });
  expect(r1.error).toBeNull();
  const r2 = await a.client.rpc('save_transactions', { items: [lama, baru] });
  expect(r2.error).toBeNull();
  expect(r2.data).toHaveLength(1);
  expect(r2.data[0].id).toBe(baru.id);
  expect(await hitung(a.client)).toBe(2);
});

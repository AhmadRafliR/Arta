import { createClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

// Akses eksplisit (aturan expo/no-dynamic-env-var).
const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const env = (n: string) => {
  const v = ENV[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_ANON_KEY'), opts);

test('insert budget makan 800.000 lalu terbaca', async () => {
  const a = await createTestUser();
  const ins = await a.client
    .from('budgets')
    .insert({ kategori: 'makan', batas_bulanan: 800000 })
    .select('id,user_id,kategori,batas_bulanan')
    .single();
  expect(ins.error).toBeNull();
  expect(ins.data!.user_id).toBe(a.userId);

  const { data, error } = await a.client.from('budgets').select('kategori,batas_bulanan');
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  expect(data![0].kategori).toBe('makan');
  expect(Number(data![0].batas_bulanan)).toBe(800000);
});

test('kategori sama beda huruf besar / spasi tepi ditolak (unik)', async () => {
  const a = await createTestUser();
  const r1 = await a.client.from('budgets').insert({ kategori: 'makan', batas_bulanan: 800000 });
  expect(r1.error).toBeNull();
  const r2 = await a.client.from('budgets').insert({ kategori: 'Makan ', batas_bulanan: 500000 });
  expect(r2.error).not.toBeNull();
  expect(r2.error!.code).toBe('23505');
  const { count } = await a.client.from('budgets').select('*', { count: 'exact', head: true });
  expect(count).toBe(1);
});

test('kategori sama milik pengguna lain tetap boleh', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const r1 = await a.client.from('budgets').insert({ kategori: 'makan', batas_bulanan: 800000 });
  expect(r1.error).toBeNull();
  const r2 = await b.client.from('budgets').insert({ kategori: 'makan', batas_bulanan: 800000 });
  expect(r2.error).toBeNull();
});

test('batas_bulanan 0, negatif, atau di atas 1 triliun ditolak; kategori kosong ditolak', async () => {
  const a = await createTestUser();
  const nol = await a.client.from('budgets').insert({ kategori: 'makan', batas_bulanan: 0 });
  expect(nol.error).not.toBeNull();
  const neg = await a.client.from('budgets').insert({ kategori: 'makan', batas_bulanan: -1 });
  expect(neg.error).not.toBeNull();
  const besar = await a.client
    .from('budgets')
    .insert({ kategori: 'makan', batas_bulanan: 1000000000001 });
  expect(besar.error).not.toBeNull();
  const kosong = await a.client.from('budgets').insert({ kategori: '   ', batas_bulanan: 1000 });
  expect(kosong.error).not.toBeNull();
  const panjang = await a.client
    .from('budgets')
    .insert({ kategori: 'x'.repeat(51), batas_bulanan: 1000 });
  expect(panjang.error).not.toBeNull();

  const { count } = await a.client.from('budgets').select('*', { count: 'exact', head: true });
  expect(count).toBe(0);
});

test('pemilik bisa mengubah dan menghapus budget sendiri', async () => {
  const a = await createTestUser();
  const { data: bud } = await a.client
    .from('budgets')
    .insert({ kategori: 'rokok', batas_bulanan: 300000 })
    .select('id')
    .single();
  const upd = await a.client
    .from('budgets')
    .update({ batas_bulanan: 250000 })
    .eq('id', bud!.id)
    .select('batas_bulanan');
  expect(upd.error).toBeNull();
  expect(upd.data).toHaveLength(1);
  expect(Number(upd.data![0].batas_bulanan)).toBe(250000);

  const del = await a.client.from('budgets').delete().eq('id', bud!.id).select('id');
  expect(del.error).toBeNull();
  expect(del.data).toHaveLength(1);
  const { data } = await a.client.from('budgets').select('id');
  expect(data).toEqual([]);
});

test('pengguna B tidak bisa membaca, mengubah, atau menghapus budget A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: bud, error } = await a.client
    .from('budgets')
    .insert({ kategori: 'makan', batas_bulanan: 800000 })
    .select('id')
    .single();
  expect(error).toBeNull();

  const sel = await b.client.from('budgets').select('*');
  expect(sel.error).toBeNull();
  expect(sel.data).toEqual([]);

  const upd = await b.client
    .from('budgets')
    .update({ batas_bulanan: 1 })
    .eq('id', bud!.id)
    .select('id');
  expect(upd.data ?? []).toEqual([]);

  const del = await b.client.from('budgets').delete().eq('id', bud!.id).select('id');
  expect(del.data ?? []).toEqual([]);

  const { data } = await a.client.from('budgets').select('batas_bulanan').eq('id', bud!.id);
  expect(data).toHaveLength(1);
  expect(Number(data![0].batas_bulanan)).toBe(800000);
});

test('pengguna B tidak bisa menyisipkan budget atas nama A atau memindahkan budgetnya ke A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const ins = await b.client
    .from('budgets')
    .insert({ user_id: a.userId, kategori: 'makan', batas_bulanan: 1000 });
  expect(ins.error).not.toBeNull();

  const { data: milikB } = await b.client
    .from('budgets')
    .insert({ kategori: 'rokok', batas_bulanan: 1000 })
    .select('id')
    .single();
  const pindah = await b.client
    .from('budgets')
    .update({ user_id: a.userId })
    .eq('id', milikB!.id);
  expect(pindah.error).not.toBeNull();

  const { data } = await a.client.from('budgets').select('id');
  expect(data).toEqual([]);
});

test('anon tidak bisa membaca atau menyisipkan budget', async () => {
  const sel = await anon().from('budgets').select('*');
  expect(sel.error).not.toBeNull();
  const ins = await anon().from('budgets').insert({ kategori: 'makan', batas_bulanan: 1000 });
  expect(ins.error).not.toBeNull();
});

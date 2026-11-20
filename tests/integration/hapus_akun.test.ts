// Migrasi 20261120000042: audit penghapusan akun.
// audit_fk_pengguna() menemukan semua tabel pengguna dari katalog, jadi tabel rencana 3/4
// yang lupa diberi "references auth.users on delete cascade" akan membuat tes ini gagal.
import { createClient } from '@supabase/supabase-js';
import { createTestUser, uuidV4 } from './helpers';

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_SERVICE_ROLE_KEY'), opts);

test('semua tabel pengguna punya FK cascade ke auth.users', async () => {
  const { data, error } = await admin().rpc('audit_fk_pengguna');
  expect(error).toBeNull();
  expect(data).toEqual([]);
});

test('authenticated tidak bisa memanggil fungsi audit', async () => {
  const a = await createTestUser();
  expect((await a.client.rpc('audit_fk_pengguna')).error).not.toBeNull();
  expect((await a.client.rpc('sisa_data_pengguna', { p_user: a.userId })).error).not.toBeNull();
  await admin().auth.admin.deleteUser(a.userId);
});

test('deleteUser menghapus semua baris pengguna di semua tabel', async () => {
  const a = await createTestUser();
  const c = a.client;

  // Isi data di sebanyak mungkin tabel milik rencana 1, 2, dan 5.
  const { data: w, error: we } = await c
    .from('wallets')
    .insert({ nama: 'GoPay', saldo_awal: 100000 })
    .select('id')
    .single();
  if (we) throw new Error(we.message);
  const save = await c.rpc('save_transactions', {
    p_items: [
      { id: uuidV4(), tanggal: '2026-11-20', jenis: 'pengeluaran', kategori: 'makan', nominal: 15000, wallet_id: w.id },
    ],
  });
  expect(save.error).toBeNull();
  await c.rpc('pakai_kuota_ai');
  await c.rpc('simpan_push_token', { p_token: `ExponentPushToken[${uuidV4()}]`, p_platform: 'android' });
  await c.from('pengaturan_pengingat').upsert({ user_id: a.userId, hari_sebelum: 3 });
  await admin().rpc('terapkan_event_langganan', {
    p_user: a.userId,
    p_pro: true,
    p_berlaku_sampai: null,
    p_produk: 'arta_pro:bulanan',
    p_periode: 'normal',
    p_akan_diperpanjang: true,
    p_event_ms: 1,
    p_sumber: 'revenuecat_sandbox',
  });
  await admin().from('log_pengingat').insert({ user_id: a.userId, kunci: 'uji' });

  const sebelum = await admin().rpc('sisa_data_pengguna', { p_user: a.userId });
  expect(sebelum.error).toBeNull();
  const tabelSebelum = (sebelum.data as { tabel: string }[]).map((r) => r.tabel);
  expect(tabelSebelum).toEqual(
    expect.arrayContaining([
      'profiles',
      'wallets',
      'categories',
      'transactions',
      'ai_usage',
      'entitlements',
      'push_tokens',
      'pengaturan_pengingat',
      'log_pengingat',
    ]),
  );

  const { error } = await admin().auth.admin.deleteUser(a.userId);
  expect(error).toBeNull();

  const sesudah = await admin().rpc('sisa_data_pengguna', { p_user: a.userId });
  expect(sesudah.error).toBeNull();
  expect(sesudah.data).toEqual([]);
});

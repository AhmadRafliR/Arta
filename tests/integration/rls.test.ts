import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

test('pengguna B tidak bisa membaca dompet A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const ins = await a.client.from('wallets').insert({ nama: 'GoPay', saldo_awal: 152000 });
  expect(ins.error).toBeNull();
  const { data, error } = await b.client.from('wallets').select('*');
  expect(error).toBeNull();
  expect(data).toEqual([]);
});

test('pengguna B tidak bisa menyisipkan dompet atas nama A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { error } = await b.client.from('wallets').insert({ nama: 'X', user_id: a.userId });
  expect(error).not.toBeNull();
});

test('pengguna baru langsung punya profil dan 9 kategori bawaan', async () => {
  const a = await createTestUser();
  const { data: p, error } = await a.client.from('profiles').select('*').single();
  expect(error).toBeNull();
  expect(p.mode_tampilan).toBe('sistem');
  const { count } = await a.client
    .from('categories')
    .select('*', { count: 'exact', head: true });
  expect(count).toBe(9);
});

test('nominal pengeluaran negatif ditolak, penyesuaian negatif diterima', async () => {
  const a = await createTestUser();
  const { data: w, error: we } = await a.client
    .from('wallets')
    .insert({ nama: 'Tunai' })
    .select()
    .single();
  expect(we).toBeNull();
  const base = { tanggal: '2026-11-19', wallet_id: w.id };

  const bad = await a.client
    .from('transactions')
    .insert({ ...base, jenis: 'pengeluaran', nominal: -5000 });
  expect(bad.error).not.toBeNull();

  const zero = await a.client
    .from('transactions')
    .insert({ ...base, jenis: 'penyesuaian', nominal: 0 });
  expect(zero.error).not.toBeNull();

  const ok = await a.client
    .from('transactions')
    .insert({ ...base, jenis: 'penyesuaian', nominal: -5000 });
  expect(ok.error).toBeNull();
});

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

test('pengguna B tidak bisa memakai dompet A sebagai wallet_id transaksi', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: w } = await a.client.from('wallets').insert({ nama: 'A' }).select().single();
  const { error } = await b.client
    .from('transactions')
    .insert({ tanggal: '2026-11-19', jenis: 'pemasukan', nominal: 1000, wallet_id: w.id });
  expect(error).not.toBeNull();
});

test('pengguna B tidak bisa memakai dompet A sebagai wallet_tujuan_id', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: wa } = await a.client.from('wallets').insert({ nama: 'A' }).select().single();
  const { data: wb } = await b.client.from('wallets').insert({ nama: 'B' }).select().single();
  const { error } = await b.client.from('transactions').insert({
    tanggal: '2026-11-19',
    jenis: 'transfer',
    nominal: 1000,
    wallet_id: wb.id,
    wallet_tujuan_id: wa.id,
  });
  expect(error).not.toBeNull();
});

test('pengguna B tidak bisa mengubah atau menghapus dompet A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: w } = await a.client.from('wallets').insert({ nama: 'Asli' }).select().single();
  await b.client.from('wallets').update({ nama: 'Diretas' }).eq('id', w.id);
  await b.client.from('wallets').delete().eq('id', w.id);
  const { data } = await a.client.from('wallets').select('*').eq('id', w.id);
  expect(data).toHaveLength(1);
  expect(data![0].nama).toBe('Asli');
});

test('pengguna B tidak melihat transaksi A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: w } = await a.client.from('wallets').insert({ nama: 'A' }).select().single();
  const ins = await a.client
    .from('transactions')
    .insert({ tanggal: '2026-11-19', jenis: 'pemasukan', nominal: 1000, wallet_id: w.id });
  expect(ins.error).toBeNull();
  const { data: mine } = await a.client.from('transactions').select('*');
  expect(mine).toHaveLength(1);
  const { data } = await b.client.from('transactions').select('*');
  expect(data).toEqual([]);
});

test('pengguna B tidak bisa memindahkan dompetnya ke user_id A', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  const { data: wb } = await b.client.from('wallets').insert({ nama: 'B' }).select().single();
  const { error } = await b.client.from('wallets').update({ user_id: a.userId }).eq('id', wb.id);
  expect(error).not.toBeNull();
});

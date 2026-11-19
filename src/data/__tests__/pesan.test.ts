import { pesanDompet, PESAN_NAMA_KEMBAR } from '../pesan';
import { PESAN_UMUM } from '../errors';

describe('pesanDompet', () => {
  const dup = { kind: 'lain', pesan: PESAN_UMUM, code: '23505' };
  it('23505 pada buat/ubah nama -> nama dompet sudah dipakai', () => {
    expect(pesanDompet(dup, { namaUnik: true })).toBe(PESAN_NAMA_KEMBAR);
    expect(pesanDompet({ code: '23505', message: 'x' }, { namaUnik: true })).toBe(PESAN_NAMA_KEMBAR);
  });
  it('tanpa namaUnik, 23505 tidak dipetakan ke pesan nama', () => {
    expect(pesanDompet(dup)).toBe(PESAN_UMUM);
  });
  it('tidak mencocokkan teks pesan', () => {
    expect(pesanDompet({ kind: 'lain', pesan: 'duplicate key' }, { namaUnik: true })).toBe('duplicate key');
  });
});

import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import BudgetIndex from '../../../app/budget/index';
import BudgetUbah from '../../../app/budget/ubah';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSimpan = jest.fn();
const mockHapus = jest.fn();
let mockId: string | undefined;
let mockBudgets: { data: unknown[] | undefined; error?: unknown };
let mockTxs: { data: unknown[] | undefined; error?: unknown };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    t: {
      accFg: '#000', accInk: '#070', mid: '#888', acc: '#0f0', fg: '#000', fg2: '#333', line: '#ddd', card2: '#f6f6f6',
      warn: '#ea0', warnInk: '#850', warnBg: '#fe9', danger: '#d55', dangerInk: '#a22', dangerSoft: '#fdd',
    },
  }),
}));
jest.mock('@/data/budgets', () => ({
  ...jest.requireActual('@/data/budgets'),
  useBudgets: () => mockBudgets,
  useSimpanBudget: () => ({ mutateAsync: mockSimpan }),
  useHapusBudget: () => ({ mutateAsync: mockHapus }),
}));
jest.mock('@/data/transactions', () => ({ useTransactions: () => mockTxs }));
jest.mock('@/animasi/useMomen', () => ({ useMomen: () => jest.fn() }));
jest.mock('@/data/categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c1', jenis: 'pengeluaran', nama: 'Makan' },
      { id: 'c2', jenis: 'pengeluaran', nama: 'Transport' },
    ],
  }),
}));

const bln = jest.requireActual('@/lib/tanggal').hariIni('Asia/Jakarta').slice(0, 7);
const B = (id: string, kategori: string, batas: number) => ({ id, kategori, batas_bulanan: batas });
const X = (id: string, nominal: number, kategori: string) => ({
  id,
  tanggal: `${bln}-02`,
  jenis: 'pengeluaran',
  kategori,
  nominal,
});
const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockId = undefined;
  mockBudgets = { data: [B('b1', 'makan', 800000), B('b2', 'transport', 100000)] };
  mockTxs = { data: [X('t1', 320000, 'Makan'), X('t2', 150000, 'Transport')] };
  mockSimpan.mockResolvedValue(undefined);
  mockHapus.mockResolvedValue(undefined);
});

describe('Budget: daftar (Budget bulanan)', () => {
  it('ringkasan dipakai dibatasi per kategori, status, dan urutan menurut persen', async () => {
    await render(<BudgetIndex />);
    expect(screen.getByText('Rp420.000')).toBeTruthy();
    expect(screen.getByText('dari Rp900.000 total batas')).toBeTruthy();
    expect(screen.getByText('47%')).toBeTruthy();
    expect(screen.getByText('1 kategori sudah lewat batas bulan ini.')).toBeTruthy();
    expect(screen.getByText('LEWAT')).toBeTruthy();
    expect(screen.getByText('AMAN')).toBeTruthy();
    expect(screen.getByText('Rp50.000 lewat')).toBeTruthy();
    const nama = screen.getAllByText(/^(Makan|Transport)$/).map((n) => n.props.children);
    expect(nama).toEqual(['Transport', 'Makan']);
  });

  it('seluruh kategori tampil sebagai baris teratas tanpa sentinel', async () => {
    mockBudgets = { data: [B('b1', 'makan', 800000), B('bs', '__semua__', 1000000)] };
    await render(<BudgetIndex />);
    expect(screen.queryByText(/__semua__/)).toBeNull();
    const nama = screen.getAllByText(/^(Makan|Seluruh kategori)$/).map((n) => n.props.children);
    expect(nama).toEqual(['Seluruh kategori', 'Makan']);
    await fireEvent.press(screen.getByRole('button', { name: /^Seluruh kategori,/ }));
    expect(mockPush).toHaveBeenCalledWith('/budget/ubah?id=bs');
  });

  it('hanya seluruh kategori: ringkasan memakai budget itu', async () => {
    mockBudgets = { data: [B('bs', '__semua__', 1000000)] };
    await render(<BudgetIndex />);
    expect(screen.getByText('dari Rp1.000.000 total batas')).toBeTruthy();
    expect(screen.getByText('1 aktif')).toBeTruthy();
  });

  it('ketuk baris membuka ubah; tambah membuka form baru', async () => {
    await render(<BudgetIndex />);
    await fireEvent.press(screen.getByRole('button', { name: /^Makan,/ }));
    expect(mockPush).toHaveBeenCalledWith('/budget/ubah?id=b1');
    await fireEvent.press(btn('Tambah budget'));
    expect(mockPush).toHaveBeenCalledWith('/budget/ubah');
  });

  it('kosong: keadaan kosong', async () => {
    mockBudgets = { data: [] };
    await render(<BudgetIndex />);
    expect(screen.getByText('Belum ada budget')).toBeTruthy();
    expect(screen.getByText('Belum diatur')).toBeTruthy();
  });

  it('galat: pesan galat; Kembali menutup', async () => {
    mockBudgets = { data: undefined, error: { kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' } };
    await render(<BudgetIndex />);
    expect(screen.getByText('Tidak ada koneksi. Coba lagi.')).toBeTruthy();
    await fireEvent.press(btn('Kembali'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Budget: tambah dan ubah', () => {
  it('tambah: kategori yang sudah punya budget dinonaktifkan; wajib pilih kategori; simpan', async () => {
    mockBudgets = { data: [B('b2', 'transport', 100000)] };
    await render(<BudgetUbah />);
    expect(screen.getByTestId('kat-Transport').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('batas'), '800000');
    await fireEvent.press(btn('Simpan'));
    expect(screen.getByText('Pilih kategori budget dulu.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    expect(screen.getByDisplayValue('800.000')).toBeTruthy();
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSimpan).toHaveBeenCalledWith({ id: undefined, kategori: 'Makan', batas_bulanan: 800000 }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('tambah: chip cepat mengisi nominal; batas minimal Rp10.000', async () => {
    mockBudgets = { data: [] };
    await render(<BudgetUbah />);
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(screen.getByRole('button', { name: 'Isi Rp500.000' }));
    expect(screen.getByDisplayValue('500.000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('batas'), '5000');
    await fireEvent.press(btn('Simpan'));
    expect(screen.getByText('Batas minimal Rp10.000.')).toBeTruthy();
    expect(mockSimpan).not.toHaveBeenCalled();
  });

  it('tambah: petak Seluruh kategori menyimpan sentinel', async () => {
    await render(<BudgetUbah />);
    await fireEvent.press(screen.getByTestId('kat-semua'));
    await fireEvent.changeText(screen.getByTestId('batas'), '2000000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSimpan).toHaveBeenCalledWith({ id: undefined, kategori: '__semua__', batas_bulanan: 2000000 }));
  });

  it('tambah: petak Seluruh kategori nonaktif bila sudah ada', async () => {
    mockBudgets = { data: [B('bs', '__semua__', 1000000)] };
    await render(<BudgetUbah />);
    expect(screen.getByTestId('kat-semua').props.accessibilityState.disabled).toBe(true);
  });

  it('ubah sentinel: subjudul Seluruh kategori tanpa sentinel', async () => {
    mockBudgets = { data: [B('bs', '__semua__', 1000000)] };
    mockId = 'bs';
    await render(<BudgetUbah />);
    expect(screen.getByText('Seluruh kategori · batas Rp1.000.000')).toBeTruthy();
    expect(screen.queryByText(/__semua__/)).toBeNull();
  });

  it('galat kembar: pesan kategori sudah ada, tidak menutup', async () => {
    mockBudgets = { data: [B('b2', 'transport', 100000)] };
    mockSimpan.mockRejectedValue({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.', code: '23505' });
    await render(<BudgetUbah />);
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.changeText(screen.getByTestId('batas'), '50000');
    await fireEvent.press(btn('Simpan'));
    expect(await screen.findByText('Budget untuk kategori ini sudah ada')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('ubah: kategori terkunci, batas terisi, catatan pemakaian, simpan dengan id', async () => {
    mockId = 'b1';
    await render(<BudgetUbah />);
    expect(screen.getByText('Ubah budget')).toBeTruthy();
    expect(screen.getByTestId('kat-Transport').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByDisplayValue('800.000')).toBeTruthy();
    expect(screen.getByText('Rp480.000 setelah disimpan.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('batas'), '900000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSimpan).toHaveBeenCalledWith({ id: 'b1', kategori: 'makan', batas_bulanan: 900000 }));
  });

  it('ubah: hapus memakai konfirmasi', async () => {
    mockId = 'b1';
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await render(<BudgetUbah />);
    await fireEvent.press(btn('Hapus budget'));
    expect(spy.mock.calls[0][0]).toBe('Hapus budget makan?');
    await waitFor(() => expect(mockHapus).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    spy.mockRestore();
  });

  it('ubah: batal pada konfirmasi tidak menghapus', async () => {
    mockId = 'b1';
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BudgetUbah />);
    await fireEvent.press(btn('Hapus budget'));
    expect(mockHapus).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

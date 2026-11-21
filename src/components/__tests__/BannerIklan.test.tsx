import { render, screen, waitFor } from '@testing-library/react-native';
import { AdsConsent } from 'react-native-google-mobile-ads';
import { setelUlangIklan } from '@/iklan/mulai.native';

let mockSession: object | null = { user: { id: 'u1' } };
let mockPro = { pro: false, memuat: false };
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/data/langganan', () => ({ usePro: () => mockPro }));

const { BannerIklan } = jest.requireActual('../BannerIklan.native') as typeof import('../BannerIklan.native');

beforeEach(() => {
  setelUlangIklan();
  mockSession = { user: { id: 'u1' } };
  mockPro = { pro: false, memuat: false };
  (AdsConsent.gatherConsent as jest.Mock).mockResolvedValue({ canRequestAds: true });
});

describe('BannerIklan', () => {
  it('menampilkan banner untuk pengguna non-Pro yang sudah masuk', async () => {
    await render(<BannerIklan />);
    expect(await screen.findByTestId('banner-ad')).toBeTruthy();
    expect(screen.getByTestId('banner-ad').props.unitId).toBe('ca-app-pub-3940256099942544/9214589741');
  });

  it('tidak menampilkan untuk pengguna Pro', async () => {
    mockPro = { pro: true, memuat: false };
    await render(<BannerIklan />);
    await waitFor(() => expect(screen.queryByTestId('banner-ad')).toBeNull());
  });

  it('tidak menampilkan selama status Pro belum pasti', async () => {
    mockPro = { pro: false, memuat: true };
    await render(<BannerIklan />);
    expect(screen.queryByTestId('banner-ad')).toBeNull();
  });

  it('tidak menampilkan bila belum masuk', async () => {
    mockSession = null;
    await render(<BannerIklan />);
    expect(screen.queryByTestId('banner-ad')).toBeNull();
  });

  it('tidak menampilkan bila pengguna tidak memberi consent', async () => {
    (AdsConsent.gatherConsent as jest.Mock).mockResolvedValue({ canRequestAds: false });
    await render(<BannerIklan />);
    await waitFor(() => expect(AdsConsent.gatherConsent).toHaveBeenCalled());
    expect(screen.queryByTestId('banner-ad')).toBeNull();
  });
});

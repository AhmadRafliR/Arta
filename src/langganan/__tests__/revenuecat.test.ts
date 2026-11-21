import Purchases from 'react-native-purchases';
import { buatPenyediaRevenueCat, PESAN_TIDAK_ADA_PULIHAN } from '../revenuecat';

const P = Purchases as unknown as Record<string, jest.Mock>;

const paketBulanan = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: {
    priceString: 'Rp19.000',
    pricePerMonthString: 'Rp19.000',
    introPrice: null,
    subscriptionOptions: null,
    defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 14, iso8601: 'P14D' } } },
  },
};
const paketTahunan = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: {
    priceString: 'Rp190.000',
    pricePerMonthString: 'Rp15.833',
    introPrice: null,
    subscriptionOptions: null,
    defaultOption: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  P.getOfferings.mockResolvedValue({ current: { availablePackages: [paketBulanan, paketTahunan] } });
});

describe('adapter RevenueCat', () => {
  it('masuk pertama configure, berikutnya logIn', async () => {
    const r = buatPenyediaRevenueCat('goog_x');
    await r.masuk('u1');
    expect(P.configure).toHaveBeenCalledWith({ apiKey: 'goog_x', appUserID: 'u1' });
    await r.masuk('u2');
    expect(P.logIn).toHaveBeenCalledWith('u2');
  });

  it('memetakan paket bulanan (trial 14 hari) dan tahunan', async () => {
    const p = await buatPenyediaRevenueCat('k').paket();
    expect(p[0]).toEqual({ id: '$rc_monthly', jenis: 'bulanan', harga: 'Rp19.000', hargaPerBulan: 'Rp19.000', ujiCobaHari: 14 });
    expect(p[1]).toMatchObject({ jenis: 'tahunan', ujiCobaHari: null });
  });

  it('trial dari introPrice berharga 0', async () => {
    P.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          { ...paketBulanan, product: { ...paketBulanan.product, defaultOption: null, introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 2 } } },
        ],
      },
    });
    expect((await buatPenyediaRevenueCat('k').paket())[0].ujiCobaHari).toBe(14);
  });

  it('beli: sukses, userCancelled -> batal, pending -> tertunda, lain -> galat', async () => {
    const r = buatPenyediaRevenueCat('k');
    await r.paket();
    P.purchasePackage.mockResolvedValueOnce({});
    expect((await r.beli('$rc_monthly')).status).toBe('sukses');
    expect(P.purchasePackage).toHaveBeenCalledWith(paketBulanan);
    P.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect((await r.beli('$rc_monthly')).status).toBe('batal');
    P.purchasePackage.mockRejectedValueOnce({ code: '20' });
    expect((await r.beli('$rc_monthly')).status).toBe('tertunda');
    P.purchasePackage.mockRejectedValueOnce(new Error('x'));
    expect((await r.beli('$rc_monthly')).status).toBe('galat');
    expect((await r.beli('tidak-ada')).status).toBe('galat');
  });

  it('beli: pesan jelas untuk sudah dibeli, offline, tidak diizinkan, dan masalah toko', async () => {
    const r = buatPenyediaRevenueCat('k');
    await r.paket();
    const pesanUntuk = async (code: string) => {
      P.purchasePackage.mockRejectedValueOnce({ code });
      const h = await r.beli('$rc_monthly');
      expect(h.status).toBe('galat');
      return h.pesan;
    };
    expect(await pesanUntuk('6')).toMatch(/Pulihkan pembelian/);
    expect(await pesanUntuk('10')).toMatch(/koneksi internet/);
    expect(await pesanUntuk('35')).toMatch(/koneksi internet/);
    expect(await pesanUntuk('3')).toMatch(/tidak diizinkan/);
    expect(await pesanUntuk('2')).toMatch(/Google Play sedang bermasalah/);
  });

  it('pulihkan: sukses hanya bila entitlement pro aktif, selain itu pesan tidak ada langganan', async () => {
    const r = buatPenyediaRevenueCat('k');
    P.restorePurchases.mockResolvedValueOnce({ entitlements: { active: { pro: { isActive: true } } } });
    expect(await r.pulihkan()).toEqual({ status: 'sukses' });
    P.restorePurchases.mockResolvedValueOnce({ entitlements: { active: {} } });
    expect(await r.pulihkan()).toEqual({ status: 'galat', pesan: PESAN_TIDAK_ADA_PULIHAN });
    P.restorePurchases.mockRejectedValueOnce({ code: '10' });
    expect((await r.pulihkan()).pesan).toMatch(/koneksi internet/);
  });

  it('urlKelola dari customerInfo, null bila galat', async () => {
    const r = buatPenyediaRevenueCat('k');
    P.getCustomerInfo.mockResolvedValueOnce({ managementURL: 'https://play/x' });
    expect(await r.urlKelola()).toBe('https://play/x');
    P.getCustomerInfo.mockRejectedValueOnce(new Error('x'));
    expect(await r.urlKelola()).toBeNull();
  });
});

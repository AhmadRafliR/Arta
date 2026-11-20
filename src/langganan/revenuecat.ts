import Purchases, { PACKAGE_TYPE, PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';
import type { HasilBeli, JenisPaket, Paket, PenyediaLangganan } from './tipe';

function jenisDari(tipe: unknown): JenisPaket {
  if (tipe === PACKAGE_TYPE.MONTHLY) return 'bulanan';
  if (tipe === PACKAGE_TYPE.ANNUAL) return 'tahunan';
  return 'lain';
}

function hariDari(unit: unknown, nilai: number): number | null {
  const u = String(unit).toUpperCase();
  if (!(nilai > 0)) return null;
  if (u === 'DAY') return nilai;
  if (u === 'WEEK') return nilai * 7;
  return null;
}

/** Lama uji coba gratis (hari): fase gratis opsi bawaan, lalu opsi lain, lalu introPrice berharga 0. */
export function ujiCobaHariDari(p: PurchasesPackage): number | null {
  const produk = p.product;
  const opsi = [produk.defaultOption, ...(produk.subscriptionOptions ?? [])];
  for (const o of opsi) {
    const fase = o?.freePhase;
    if (fase) {
      const h = hariDari(fase.billingPeriod.unit, fase.billingPeriod.value);
      if (h) return h;
    }
  }
  const intro = produk.introPrice;
  if (intro && intro.price === 0) return hariDari(intro.periodUnit, intro.periodNumberOfUnits);
  return null;
}

export function petakanPaket(p: PurchasesPackage): Paket {
  return {
    id: p.identifier,
    jenis: jenisDari(p.packageType),
    harga: p.product.priceString,
    hargaPerBulan: p.product.pricePerMonthString ?? null,
    ujiCobaHari: ujiCobaHariDari(p),
  };
}

function petakanGalat(e: unknown): HasilBeli {
  const err = (e ?? {}) as { userCancelled?: boolean | null; code?: unknown };
  if (err.userCancelled === true || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { status: 'batal' };
  }
  if (err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return { status: 'tertunda', pesan: 'Pembayaran masih menunggu persetujuan. Status Pro aktif setelah selesai.' };
  }
  return { status: 'galat', pesan: 'Pembayaran belum berhasil. Coba lagi sebentar lagi.' };
}

/** Adapter RevenueCat (Android). Status Pro tetap diputuskan server lewat webhook, bukan hasil di sini. */
export function buatPenyediaRevenueCat(apiKey: string): PenyediaLangganan {
  let terkonfigurasi = false;
  const peta = new Map<string, PurchasesPackage>();
  return {
    nama: 'revenuecat',
    async masuk(userId) {
      if (!terkonfigurasi) {
        Purchases.configure({ apiKey, appUserID: userId });
        terkonfigurasi = true;
        return;
      }
      await Purchases.logIn(userId);
    },
    async keluar() {
      if (!terkonfigurasi) return;
      try {
        await Purchases.logOut();
      } catch {
        // pengguna sudah anonim: logOut galat, abaikan
      }
    },
    async paket() {
      const o = await Purchases.getOfferings();
      const daftar = o.current?.availablePackages ?? [];
      peta.clear();
      daftar.forEach((p) => peta.set(p.identifier, p));
      return daftar.map(petakanPaket);
    },
    async beli(paketId) {
      const p = peta.get(paketId);
      if (!p) return { status: 'galat', pesan: 'Paket tidak ditemukan. Muat ulang halaman ini.' };
      try {
        await Purchases.purchasePackage(p);
        return { status: 'sukses' };
      } catch (e) {
        return petakanGalat(e);
      }
    },
    async pulihkan() {
      try {
        await Purchases.restorePurchases();
        return { status: 'sukses' };
      } catch (e) {
        return petakanGalat(e);
      }
    },
    async urlKelola() {
      try {
        const info = await Purchases.getCustomerInfo();
        return info.managementURL ?? null;
      } catch {
        return null;
      }
    },
  };
}

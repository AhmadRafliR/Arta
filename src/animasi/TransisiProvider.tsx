import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TransisiNabung } from '@/components/animasi/TransisiNabung';

/**
 * Transisi "orang menabung" untuk momen penting (setelah login, dst.) lewat useTransisi().putar().
 * JANGAN dipakai di setiap perpindahan halaman biasa: mengganggu dan terasa lambat. Dipanggil
 * hanya di momen yang memang butuh jeda (masuk baru, selesai penyiapan akun, dsb.).
 */
export type OpsiTransisi = {
  judul: string;
  sub?: string;
  minimalMs?: number;
  /** Animasi mengulang sampai promise ini selesai (resolve/reject sama-sama dianggap siap). */
  tunggu?: Promise<unknown>;
};

type TransisiValue = { putar: (opsi: OpsiTransisi) => Promise<void> };

// Batas pengaman: bila `tunggu` tak pernah selesai, overlay tidak menutup app selamanya.
export const BATAS_TUNGGU_MS = 20000;

const TransisiContext = createContext<TransisiValue | null>(null);

type Aktif = { opsi: OpsiTransisi; siap: boolean };

export function TransisiProvider({ children }: { children: React.ReactNode }) {
  const [aktif, setAktif] = useState<Aktif | null>(null);
  const janji = useRef<Promise<void> | null>(null);
  const selesaiRef = useRef<(() => void) | null>(null);
  const hidup = useRef(true);
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const putar = useCallback((opsi: OpsiTransisi) => {
    // Sedang berputar: pemanggil kedua ikut menunggu transisi yang sama.
    if (janji.current) return janji.current;
    const p = new Promise<void>((resolve) => {
      selesaiRef.current = resolve;
    });
    janji.current = p;
    setAktif({ opsi, siap: !opsi.tunggu });
    if (opsi.tunggu) {
      let selesai = false;
      const siap = () => {
        if (selesai) return;
        selesai = true;
        clearTimeout(batas);
        if (hidup.current) setAktif((a) => (a ? { ...a, siap: true } : a));
      };
      const batas = setTimeout(siap, BATAS_TUNGGU_MS);
      opsi.tunggu.then(siap, siap);
    }
    return p;
  }, []);

  const tutup = useCallback(() => {
    const r = selesaiRef.current;
    selesaiRef.current = null;
    janji.current = null;
    setAktif(null);
    r?.();
  }, []);

  const value = useMemo<TransisiValue>(() => ({ putar }), [putar]);
  return (
    <TransisiContext.Provider value={value}>
      {children}
      {aktif ? (
        <TransisiNabung
          judul={aktif.opsi.judul}
          sub={aktif.opsi.sub}
          minimalMs={aktif.opsi.minimalMs}
          siap={aktif.siap}
          onSelesai={tutup}
        />
      ) : null}
    </TransisiContext.Provider>
  );
}

export function useTransisi(): TransisiValue {
  const ctx = useContext(TransisiContext);
  if (!ctx) throw new Error('useTransisi harus dipakai di dalam TransisiProvider');
  return ctx;
}

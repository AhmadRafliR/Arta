import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AMBANG_MASUK, statusBerikut, type StatusNav } from './pulau';

type NavAksi = {
  aktifkan: (rute: string) => void;
  laporGulir: (rute: string, y: number) => void;
};
type NavPulau = NavAksi & { status: StatusNav };

// Dua konteks: aksi stabil (layar tab, tak render ulang saat status berubah) dan status (TabBar).
// Tanpa Provider (mis. layar dirender sendiri di tes): selalu penuh, laporan diabaikan.
const AksiContext = createContext<NavAksi>({ aktifkan: () => {}, laporGulir: () => {} });
const StatusContext = createContext<StatusNav>('penuh');

export function NavPulauProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StatusNav>('penuh');
  const statusRef = useRef<StatusNav>('penuh');
  const offset = useRef<Record<string, number>>({});
  const ruteAktif = useRef<string | null>(null);

  // setState hanya bila status benar-benar berubah.
  const ubah = useCallback((s: StatusNav) => {
    if (s === statusRef.current) return;
    statusRef.current = s;
    setStatus(s);
  }, []);

  const aktifkan = useCallback(
    (rute: string) => {
      ruteAktif.current = rute;
      ubah((offset.current[rute] ?? 0) > AMBANG_MASUK ? 'pulau' : 'penuh');
    },
    [ubah],
  );

  const laporGulir = useCallback(
    (rute: string, y: number) => {
      if (!Number.isFinite(y)) return;
      offset.current[rute] = y;
      if (ruteAktif.current !== rute) return;
      ubah(statusBerikut(statusRef.current, y));
    },
    [ubah],
  );

  const aksi = useMemo(() => ({ aktifkan, laporGulir }), [aktifkan, laporGulir]);
  return (
    <AksiContext.Provider value={aksi}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </AksiContext.Provider>
  );
}

/** Hanya aksi (stabil): untuk layar tab. */
export function useNavAksi(): NavAksi {
  return useContext(AksiContext);
}

/** Hanya status: untuk TabBar. */
export function useStatusNav(): StatusNav {
  return useContext(StatusContext);
}

/** Status + aksi. Render ulang saat status berubah; layar tab pakai useGulirPulau. */
export function useNavPulau(): NavPulau {
  const aksi = useContext(AksiContext);
  const status = useContext(StatusContext);
  return useMemo(() => ({ status, ...aksi }), [status, aksi]);
}

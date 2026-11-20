import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AMBANG_MASUK, statusBerikut, type StatusNav } from './pulau';

type NavPulau = {
  status: StatusNav;
  aktifkan: (rute: string) => void;
  laporGulir: (rute: string, y: number) => void;
};

// Tanpa Provider (mis. layar dirender sendiri di tes): selalu penuh, laporan diabaikan.
const NavPulauContext = createContext<NavPulau>({ status: 'penuh', aktifkan: () => {}, laporGulir: () => {} });

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

  const nilai = useMemo(() => ({ status, aktifkan, laporGulir }), [status, aktifkan, laporGulir]);
  return <NavPulauContext.Provider value={nilai}>{children}</NavPulauContext.Provider>;
}

export function useNavPulau(): NavPulau {
  return useContext(NavPulauContext);
}

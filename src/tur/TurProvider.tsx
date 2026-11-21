import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { useTransisiOpsional } from '@/animasi/TransisiProvider';
import { useAuth } from '@/auth/AuthProvider';
import { setLapisan, useLapisanLainAktif } from '@/lib/lapisan';
import { KUNCI_DIKENALKAN } from '@/notifikasi-dompet/GerbangIzin';
import { izinAktif, tersedia } from '../../modules/notifikasi-dompet';
import { langkahUntuk, type LangkahTur } from './langkah';
import { JEDA_BAWAAN, OverlayTur, type JedaTur } from './OverlayTur';

/** Penanda tur sudah selesai atau dilewati di perangkat ini. */
export const KUNCI_TUR = 'arta:tur-selesai';

function aman<T>(f: () => T, cadangan: T): T {
  try {
    return f();
  } catch {
    return cadangan;
  }
}

const notifDompetAda = () => Platform.OS === 'android' && aman(tersedia, false);

type TurValue = { mulai: () => void; aktif: boolean };
const TurContext = createContext<TurValue | null>(null);

/** null di luar TurProvider (mis. tes layar). */
export function useTurOpsional(): TurValue | null {
  return useContext(TurContext);
}

/**
 * Tur fitur untuk pengguna baru: dimulai otomatis sekali setelah masuk ke app (setelah layar catat otomatis
 * diperkenalkan di Android), bisa diulang lewat useTurOpsional().mulai() dari Akun.
 */
export function TurProvider({ children, jeda = JEDA_BAWAAN }: { children: ReactNode; jeda?: JedaTur }) {
  const router = useRouter();
  const [daftar, setDaftar] = useState<LangkahTur[] | null>(null);
  const [indeks, setIndeks] = useState(0);
  const aktif = daftar !== null;

  useEffect(() => {
    setLapisan('tur', aktif);
  }, [aktif]);
  useEffect(() => () => setLapisan('tur', false), []);

  const mulai = useCallback(() => {
    setIndeks(0);
    setDaftar(langkahUntuk({ notifDompet: notifDompetAda() }));
  }, []);

  const tutup = useCallback(() => {
    setDaftar(null);
    AsyncStorage.setItem(KUNCI_TUR, '1').catch(() => {});
    router.navigate('/');
  }, [router]);

  const lanjut = useCallback(() => {
    if (!daftar) return;
    if (indeks >= daftar.length - 1) tutup();
    else setIndeks(indeks + 1);
  }, [daftar, indeks, tutup]);
  const kembali = useCallback(() => setIndeks((i) => Math.max(0, i - 1)), []);

  const value = useMemo(() => ({ mulai, aktif }), [mulai, aktif]);
  const langkah = daftar?.[indeks];
  return (
    <TurContext.Provider value={value}>
      {children}
      <PemicuTur aktif={aktif} mulai={mulai} jedaMulai={jeda.mulai} />
      {daftar && langkah ? (
        <OverlayTur
          langkah={langkah}
          indeks={indeks}
          jumlah={daftar.length}
          jeda={jeda}
          onLanjut={lanjut}
          onKembali={kembali}
          onLewati={tutup}
        />
      ) : null}
    </TurContext.Provider>
  );
}

/** Memulai tur sekali untuk pengguna yang belum pernah menyelesaikannya. */
function PemicuTur({ aktif, mulai, jedaMulai }: { aktif: boolean; mulai: () => void; jedaMulai: number }) {
  const segmen = useSegments();
  const { session, profile } = useAuth();
  const transisi = useTransisiOpsional();
  const lainAktif = useLapisanLainAktif('tur');
  const sudah = useRef(false);
  const siap =
    !aktif &&
    !!session &&
    profile?.onboarding_selesai === true &&
    segmen[0] === '(tabs)' &&
    !(transisi?.sedangPutar ?? false) &&
    !lainAktif;

  useEffect(() => {
    if (!siap || sudah.current) return;
    let batal = false;
    const id = setTimeout(() => {
      void (async () => {
        let selesai: string | null = null;
        try {
          selesai = await AsyncStorage.getItem(KUNCI_TUR);
        } catch {
          selesai = '1';
        }
        if (batal) return;
        if (selesai) {
          sudah.current = true;
          return;
        }
        // Android: layar catat otomatis (fitur utama) diperkenalkan dulu bila izinnya belum ada.
        if (notifDompetAda() && !aman(izinAktif, false)) {
          let dikenalkan: string | null = null;
          try {
            dikenalkan = await AsyncStorage.getItem(KUNCI_DIKENALKAN);
          } catch {
            dikenalkan = '1';
          }
          if (!dikenalkan || batal) return;
        }
        sudah.current = true;
        mulai();
      })();
    }, jedaMulai);
    return () => {
      batal = true;
      clearTimeout(id);
    };
  }, [siap, mulai, jedaMulai]);

  return null;
}

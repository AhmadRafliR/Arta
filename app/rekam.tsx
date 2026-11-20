import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { setDraf } from '@/ai/drafStore';
import { Ikon } from '@/components/ikon/Ikon';
import { KartuKuotaHabis, PilKuota } from '@/components/PilKuota';
import { Tombol } from '@/components/Tombol';
import { TombolRekam } from '@/components/TombolRekam';
import { sisaKuota, useKirimKeAi, useKuotaAi, type InputAi } from '@/data/ai';
import { PESAN_UMUM, type AppError } from '@/data/errors';
import { useTheme } from '@/theme/ThemeProvider';

const BATAS_MS = 60_000;
const MINIMAL_MS = 500;
const MAKS_TEKS = 500;
const OPSI_REKAM = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

const PESAN_PENDEK = 'Tahan lebih lama untuk merekam';
const PESAN_IZIN = 'Izin mikrofon ditolak. Buka Pengaturan untuk mengizinkan, atau pakai "Ketik saja".';
const PESAN_IZIN_BARU = 'Mikrofon siap. Tahan lagi untuk merekam.';
const PESAN_MIC_GAGAL = 'Mikrofon tidak bisa dipakai. Coba lagi atau pakai "Ketik saja".';
const PESAN_KOSONG = 'Belum ada transaksi yang terbaca. Coba sebutkan nominal dan untuk apa.';

type Status = 'siap' | 'menyiapkan' | 'merekam' | 'memproses';
type Info = { jenis: 'pertanyaan' | 'galat' | 'izin' | 'catatan'; teks: string; ulang?: InputAi } | null;

const MIME: Record<string, string> = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  '3gp': 'audio/3gpp',
  webm: 'audio/webm',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
};

function mimeDariUri(uri: string) {
  const ext = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'audio/m4a';
}

// Modal catat pakai suara: tahan tombol mic untuk merekam, lepas untuk kirim; atau ketik.
export default function Rekam() {
  const router = useRouter();
  const { t } = useTheme();
  const recorder = useAudioRecorder(OPSI_REKAM);
  const kirimAi = useKirimKeAi();
  const { data: kuota } = useKuotaAi();

  const [status, setStatus] = useState<Status>('siap');
  const [info, setInfo] = useState<Info>(null);
  const [habisServer, setHabisServer] = useState(false);
  const [ketik, setKetik] = useState(false);
  const [teks, setTeks] = useState('');
  const [prosesTeks, setProsesTeks] = useState(false);

  const statusRef = useRef<Status>('siap');
  const mulaiRef = useRef<Promise<boolean> | null>(null);
  const mulaiPadaRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aktifRef = useRef(true);

  const ubahStatus = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    aktifRef.current = true;
    return () => {
      aktifRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Layar ditutup (back/gestur) saat merekam: hentikan perekam dan kembalikan mode audio.
      if (statusRef.current === 'merekam' || statusRef.current === 'menyiapkan') {
        try {
          void recorder.stop().catch(() => {});
        } catch {
          // perekam sudah dilepas
        }
        setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    };
  }, [recorder]);

  const habis = habisServer || (kuota ? sisaKuota(kuota) <= 0 : false);
  const tutup = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const keManual = () => router.replace('/catat');

  const kirim = async (input: InputAi) => {
    ubahStatus('memproses');
    setProsesTeks('teks' in input);
    setInfo(null);
    try {
      const h = await kirimAi(input);
      if (!aktifRef.current) return;
      if (!h.butuh_klarifikasi && (h.draf.length > 0 || h.koreksi.length > 0 || h.tidakDidukung.length > 0)) {
        setDraf(h);
        router.replace('/cek');
        return;
      }
      setInfo({ jenis: 'pertanyaan', teks: h.pertanyaan || PESAN_KOSONG });
    } catch (e) {
      if (!aktifRef.current) return;
      const g = (e && typeof e === 'object' ? e : {}) as Partial<AppError>;
      if (g.kind === 'kuota') setHabisServer(true);
      else setInfo({ jenis: 'galat', teks: g.pesan || PESAN_UMUM, ulang: input });
    }
    ubahStatus('siap');
  };

  const berhenti = async () => {
    const p = mulaiRef.current;
    if (!p) return;
    mulaiRef.current = null; // lepas tombol setelah berhenti otomatis: diabaikan
    if (!(await p)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    let durasi = 0;
    try {
      durasi = recorder.getStatus().durationMillis;
    } catch {
      // status tidak terbaca: pakai jam sendiri
    }
    if (!durasi) durasi = Date.now() - mulaiPadaRef.current;
    try {
      await recorder.stop();
    } catch {
      // rekaman mungkin sudah berhenti
    }
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (!aktifRef.current) return;
    const uri = recorder.uri;
    if (durasi < MINIMAL_MS || !uri) {
      ubahStatus('siap');
      setInfo({ jenis: 'catatan', teks: PESAN_PENDEK });
      return;
    }
    await kirim({ audioUri: uri, mime: mimeDariUri(uri) });
  };

  const mulai = async () => {
    if (statusRef.current !== 'siap' || habis) return;
    setInfo(null);
    ubahStatus('menyiapkan');
    const p = (async () => {
      try {
        const izin = await getRecordingPermissionsAsync();
        if (!izin.granted) {
          if (izin.canAskAgain !== false) {
            const baru = await requestRecordingPermissionsAsync();
            // Jari sudah lepas saat dialog izin muncul; minta tahan ulang.
            if (baru.granted) {
              setInfo({ jenis: 'catatan', teks: PESAN_IZIN_BARU });
              return false;
            }
          }
          setInfo({ jenis: 'izin', teks: PESAN_IZIN });
          return false;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        mulaiPadaRef.current = Date.now();
        if (!aktifRef.current) {
          // Layar sudah ditutup saat perekam disiapkan: jangan biarkan rekaman jalan.
          await recorder.stop().catch(() => {});
          setAudioModeAsync({ allowsRecording: false }).catch(() => {});
          return false;
        }
        ubahStatus('merekam');
        timerRef.current = setTimeout(() => void berhenti(), BATAS_MS);
        return true;
      } catch {
        setInfo({ jenis: 'galat', teks: PESAN_MIC_GAGAL });
        return false;
      }
    })();
    mulaiRef.current = p;
    if (!(await p)) {
      if (mulaiRef.current === p) mulaiRef.current = null;
      ubahStatus('siap');
    }
  };

  const bacaStatus = useCallback(() => recorder.getStatus(), [recorder]);

  const memproses = status === 'memproses';
  const bantu = status === 'merekam' ? 'Lepas untuk kirim' : memproses ? 'Memproses…' : 'Tahan, ngomong, lepas.';
  const teksBersih = teks.trim();

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
        <Text className="text-lg font-bold text-fg font-sans">Catat pakai suara</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Batal" onPress={tutup} className="px-2 py-1">
          <Text className="text-mid font-sans">Batal</Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 24 }}
      >
        {habis ? (
          <KartuKuotaHabis onCatatManual={keManual} />
        ) : kuota && !kuota.pro ? (
          <PilKuota sisa={sisaKuota(kuota)} />
        ) : null}

        <View className="items-center pt-4" style={{ gap: 12 }}>
          <TombolRekam
            merekam={status === 'merekam'}
            disabled={habis || memproses}
            onMulai={() => void mulai()}
            onBerhenti={() => void berhenti()}
            bacaStatus={bacaStatus}
          />
          <Text className="text-center text-[15px] text-fg2 font-sans" accessibilityLiveRegion="polite">
            {bantu}
          </Text>
        </View>

        {info ? (
          <View className="rounded-2xl border border-line bg-card p-4" style={{ gap: 12 }}>
            <Text
              accessibilityLiveRegion="polite"
              className={`text-[15px] font-sans ${info.jenis === 'galat' || info.jenis === 'izin' ? 'text-dangerink' : 'text-fg'}`}
            >
              {info.teks}
            </Text>
            {info.jenis === 'izin' ? (
              <Tombol label="Buka Pengaturan" onPress={() => void Linking.openSettings()} />
            ) : null}
            {info.ulang ? (
              <Tombol label="Coba lagi" disabled={memproses} onPress={() => info.ulang && void kirim(info.ulang)} />
            ) : null}
          </View>
        ) : null}

        {!habis ? (
          ketik ? (
            <View style={{ gap: 12 }}>
              <TextInput
                testID="input-ketik"
                accessibilityLabel="Tulis transaksi"
                value={teks}
                onChangeText={setTeks}
                multiline
                maxLength={MAKS_TEKS}
                autoFocus
                placeholder="Contoh: tadi rokok 25rb pake gopay, parkir 2rb cash"
                placeholderTextColor={t.mid}
                className="rounded-2xl border border-line bg-card p-4 text-[16px] text-fg font-sans"
                style={{ minHeight: 110, textAlignVertical: 'top' }}
              />
              <Text className="text-right text-[12px] text-mid font-sans">{`${teks.length}/${MAKS_TEKS}`}</Text>
              <Tombol
                label="Kirim"
                primary
                disabled={!teksBersih || status !== 'siap'}
                busy={memproses && prosesTeks}
                onPress={() => void kirim({ teks: teksBersih })}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ketik saja"
              onPress={() => setKetik(true)}
              className="flex-row items-center justify-center py-2"
              style={{ gap: 8 }}
            >
              <Ikon nama="act-ketik" ukuran={20} warna={t.fg} />
              <Text className="text-[15px] font-semibold text-fg font-sans">Ketik saja</Text>
            </Pressable>
          )
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Isi formulir manual"
          onPress={keManual}
          className="items-center py-2"
        >
          <Text className="text-[14px] text-mid underline font-sans">Isi formulir manual</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

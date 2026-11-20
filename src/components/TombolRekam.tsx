import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ikon } from '@/components/ikon/Ikon';
import { useTheme } from '@/theme/ThemeProvider';

export type StatusPerekam = { durationMillis: number; metering?: number };

type Props = {
  merekam: boolean;
  disabled?: boolean;
  onMulai: () => void;
  onBerhenti: () => void;
  /** Dibaca berkala selama merekam (durasi + metering dBFS). */
  bacaStatus: () => StatusPerekam;
};

const JUMLAH_BAR = 5;
const SELANG_MS = 100;
const DIAM = Array<number>(JUMLAH_BAR).fill(0);

// dBFS (-160..0) ke 0..1; di bawah -50 dB dianggap hening.
function normal(db: number | undefined) {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 50) / 50));
}

function formatDetik(d: number) {
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
}

// Tombol mic besar tahan-untuk-rekam, dengan 5 bar level dan penghitung detik.
// Polling status ada di sini agar hanya tombol ini yang dirender ulang selama merekam.
export function TombolRekam({ merekam, disabled, onMulai, onBerhenti, bacaStatus }: Props) {
  const { t } = useTheme();
  const [level, setLevel] = useState<number[]>(DIAM);
  const [detik, setDetik] = useState(0);

  useEffect(() => {
    if (!merekam) return;
    const id = setInterval(() => {
      let s: StatusPerekam;
      try {
        s = bacaStatus();
      } catch {
        return;
      }
      setDetik(Math.floor(s.durationMillis / 1000));
      setLevel((l) => [...l.slice(1), normal(s.metering)]);
    }, SELANG_MS);
    return () => {
      clearInterval(id);
      setLevel(DIAM);
      setDetik(0);
    };
  }, [merekam, bacaStatus]);

  return (
    <View className="items-center" style={{ gap: 16 }}>
      <Pressable
        testID="tombol-rekam"
        accessibilityRole="button"
        accessibilityLabel="Tahan untuk merekam"
        accessibilityHint="Tahan sambil bicara, lepas untuk mengirim"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPressIn={onMulai}
        onPressOut={onBerhenti}
        style={{
          width: 96,
          height: 96,
          borderRadius: 999,
          backgroundColor: t.acc,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: merekam ? 1.08 : 1 }],
          elevation: 8,
          shadowColor: t.acc,
          shadowOpacity: 0.4,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Ikon nama="act-mic" ukuran={40} warna={t.accFg} />
      </Pressable>
      <View
        testID="level-rekam"
        className="flex-row items-end"
        style={{ height: 36, gap: 5, opacity: merekam ? 1 : 0.25 }}
        importantForAccessibility="no-hide-descendants"
      >
        {level.map((l, i) => (
          <View key={i} style={{ width: 6, height: 6 + l * 30, borderRadius: 3, backgroundColor: t.acc }} />
        ))}
      </View>
      <Text
        className="text-[15px] font-semibold text-fg font-sans"
        style={{ fontVariant: ['tabular-nums'], opacity: merekam ? 1 : 0 }}
        accessibilityElementsHidden={!merekam}
      >
        {`${formatDetik(detik)} / 1:00`}
      </Text>
    </View>
  );
}

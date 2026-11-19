import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AmountInput } from '@/components/AmountInput';
import { useAuth } from '@/auth/AuthProvider';
import { useCreateWallet } from '@/data/wallets';
import { toAppError, type AppError } from '@/data/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

type Row = { key: number; nama: string; saldo: number | null; dibuat?: boolean };

const BAWAAN = ['GoPay', 'Cash', 'ShopeePay'];

// Hook data sudah melempar AppError; galat mentah (mis. dari supabase) dibungkus.
function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}

function hariIniLokal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function DompetAwal() {
  const { session, refreshProfile } = useAuth();
  const { t } = useTheme();
  const createWallet = useCreateWallet();
  const [nama, setNama] = useState('');
  const [rows, setRows] = useState<Row[]>(() => BAWAAN.map((n, i) => ({ key: i, nama: n, saldo: 0 })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(BAWAAN.length);

  const namaBersih = rows.map((r) => r.nama.trim().toLowerCase());
  const kembar = namaBersih.some((n, i) => n !== '' && namaBersih.indexOf(n) !== i);
  const valid = rows.length > 0 && !kembar && rows.every((r) => r.nama.trim() !== '' && r.saldo !== null);
  const nonaktif = busy || !valid;

  function ubah(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function mulai() {
    if (nonaktif || !session) return;
    setBusy(true);
    setError(null);
    try {
      const tanggal = hariIniLokal();
      for (const r of rows) {
        // Baris yang sudah dibuat (terkunci) dilewati saat coba lagi: tanpa duplikat.
        if (r.dibuat) continue;
        await createWallet.mutateAsync({
          nama: r.nama.trim(),
          tipe: 'harian',
          saldo_awal: r.saldo ?? 0,
          tanggal_saldo_awal: tanggal,
        });
        ubah(r.key, { dibuat: true });
      }
      const { error: err } = await supabase
        .from('profiles')
        .update({ nama: nama.trim() || null, onboarding_selesai: true })
        .eq('id', session.user.id);
      if (err) throw toAppError(err);
      refreshProfile(); // AuthGate mengalihkan ke /(tabs)
    } catch (e) {
      setError(pesanGalat(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-4 px-6 py-12">
      <Text className="text-2xl font-bold text-fg">Selamat datang</Text>
      <Text className="text-mid">Siapa nama panggilanmu?</Text>
      <TextInput
        value={nama}
        onChangeText={setNama}
        placeholder="Nama panggilan"
        placeholderTextColor={t.mid}
        className="rounded-xl border border-line bg-card px-4 py-3 text-fg"
      />

      <Text className="mt-2 text-lg font-semibold text-fg">Dompetmu</Text>
      <Text className="text-mid">Isi saldo awal tiap dompet. Boleh Rp0.</Text>

      {rows.map((r) => (
        <View key={r.key} className="gap-2 rounded-2xl border border-line bg-card p-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={r.nama}
              editable={!r.dibuat}
              onChangeText={(v) => ubah(r.key, { nama: v })}
              placeholder="Nama dompet"
              placeholderTextColor={t.mid}
              className="flex-1 rounded-xl border border-line px-4 py-2 text-fg"
            />
            {r.dibuat ? (
              <Text className="px-3 text-xs text-mid">sudah dibuat</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hapus dompet"
                onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="px-3 py-2"
              >
                <Text className="text-mid">Hapus</Text>
              </Pressable>
            )}
          </View>
          <AmountInput value={r.saldo} allowZero editable={!r.dibuat} onChange={(n) => ubah(r.key, { saldo: n })} />
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => setRows((rs) => [...rs, { key: nextKey.current++, nama: '', saldo: 0 }])}
        className="items-center rounded-xl border border-line py-3"
      >
        <Text className="font-semibold text-fg">Tambah dompet</Text>
      </Pressable>

      {kembar ? <Text className="text-fg">Nama dompet tidak boleh sama.</Text> : null}
      {error ? <Text className="text-fg">{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mulai"
        accessibilityState={{ disabled: nonaktif }}
        disabled={nonaktif}
        onPress={mulai}
        className={`items-center rounded-xl bg-acc py-3 ${nonaktif ? 'opacity-50' : ''}`}
      >
        {busy ? (
          <ActivityIndicator color={t.accFg} />
        ) : (
          <Text style={{ color: t.accFg }} className="font-semibold">
            Mulai
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

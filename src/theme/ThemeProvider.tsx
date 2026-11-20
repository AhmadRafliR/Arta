import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import { vars } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveMode } from './resolveMode';
import { tokens, type Mode, type Pref, type Tokens } from './tokens';

export const TEMA_PREF_KEY = 'tema_pref';

type ThemeValue = { mode: Mode; t: Tokens; pref: Pref; setPref: (p: Pref) => void };

const ThemeContext = createContext<ThemeValue | null>(null);

function isPref(v: unknown): v is Pref {
  return v === 'sistem' || v === 'terang' || v === 'gelap';
}

// NativeWind: kanal warna dalam CSS variables, dipakai tailwind.config.js (bg-bg, text-fg, ...).
function toVars(t: Tokens) {
  return vars({
    '--color-bg': t.bg,
    '--color-card': t.card,
    '--color-fg': t.fg,
    '--color-mid': t.mid,
    '--color-line': t.line,
    '--color-acc': t.acc,
    '--color-card2': t.card2,
    '--color-fg2': t.fg2,
    '--color-accink': t.accInk,
    '--color-warn': t.warn,
    '--color-warnink': t.warnInk,
    '--color-danger': t.danger,
    '--color-dangerink': t.dangerInk,
    '--color-accsoft': t.accSoft,
    '--color-dangersoft': t.dangerSoft,
    '--color-warnbg': t.warnBg,
    '--color-segactive': t.segActive,
  });
}

export function ThemeProvider({
  children,
  onPrefChange,
}: {
  children: React.ReactNode;
  onPrefChange?: (p: Pref) => void;
}) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<Pref>('sistem');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TEMA_PREF_KEY)
      .then((v) => {
        if (alive && isPref(v)) setPrefState(v);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setPref = useCallback(
    (p: Pref) => {
      setPrefState(p);
      AsyncStorage.setItem(TEMA_PREF_KEY, p).catch(() => {});
      onPrefChange?.(p);
    },
    [onPrefChange],
  );

  const mode = resolveMode(pref, system === 'dark' || system === 'light' ? system : null);
  const value = useMemo<ThemeValue>(
    () => ({ mode, t: tokens[mode], pref, setPref }),
    [mode, pref, setPref],
  );
  const style = useMemo(() => toVars(tokens[mode]), [mode]);

  // Tahan render sampai pref tersimpan terbaca, agar tidak berkedip tema salah.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider');
  return ctx;
}

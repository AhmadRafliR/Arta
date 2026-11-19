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

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TEMA_PREF_KEY)
      .then((v) => {
        if (alive && isPref(v)) setPrefState(v);
      })
      .catch(() => {});
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

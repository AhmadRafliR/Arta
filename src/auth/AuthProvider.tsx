import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Pref } from '@/theme/tokens';

export type Profile = {
  id: string;
  nama: string | null;
  zona_waktu: string;
  mode_tampilan: Pref;
  onboarding_selesai: boolean;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: boolean;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setSessionLoaded(true);
      });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setSessionLoaded(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileError(false);
      setProfileLoading(false);
      return;
    }
    let alive = true;
    setProfileLoading(true);
    setProfileError(false);
    supabase
      .from('profiles')
      .select('id, nama, zona_waktu, mode_tampilan, onboarding_selesai')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        // Gagal jaringan / baris tidak ada / tabel belum dimigrasi -> tampilkan layar galat.
        if (error || !data) {
          setProfile(null);
          setProfileError(true);
        } else {
          setProfile(data as Profile);
        }
      })
      .then(undefined, () => {
        if (alive) setProfileError(true);
      })
      .then(() => {
        if (alive) setProfileLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, refreshKey]);

  const refreshProfile = useCallback(() => setRefreshKey((k) => k + 1), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, profile, loading: !sessionLoaded || (!!session && profileLoading), profileError, refreshProfile, signOut }),
    [session, profile, sessionLoaded, profileLoading, profileError, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

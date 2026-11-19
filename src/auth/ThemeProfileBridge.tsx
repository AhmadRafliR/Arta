import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

// Setelah profil termuat, terapkan mode_tampilan-nya hanya bila berbeda dari pref saat ini
// (setPref menulis balik ke profil, jadi tanpa pengecekan ini bisa berulang).
export function ThemeProfileBridge() {
  const { profile } = useAuth();
  const { pref, setPref } = useTheme();
  const target = profile?.mode_tampilan;
  useEffect(() => {
    if (target && target !== pref) setPref(target);
    // Hanya bereaksi pada profil baru; perubahan pref lokal ditulis lewat onPrefChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return null;
}

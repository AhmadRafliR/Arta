import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';

// Kunci query tidak dikaitkan ke pengguna; kosongkan seluruh cache setiap user id berubah
// (termasuk keluar -> null) agar data satu akun tidak terbaca akun lain di HP yang sama.
export function QueryCacheGuard() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const sebelumnya = useRef(userId);
  useEffect(() => {
    if (sebelumnya.current !== userId) {
      sebelumnya.current = userId;
      qc.clear();
    }
  }, [userId, qc]);
  return null;
}

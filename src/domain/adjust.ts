/** Selisih bertanda untuk menyesuaikan saldo; null bila sudah sama. */
export function adjustmentFor(saldoSekarang: number, saldoBaru: number): number | null {
  const d = saldoBaru - saldoSekarang;
  return d === 0 ? null : d;
}

/** Dompet hanya boleh diarsip saat saldonya 0. */
export function canArchive(saldo: number): boolean {
  return saldo === 0;
}

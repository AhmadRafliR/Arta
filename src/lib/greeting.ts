export type Sapaan = 'Selamat pagi' | 'Selamat siang' | 'Selamat sore' | 'Selamat malam';

// Sama seperti PANTRA: <11 pagi, <15 siang, <18 sore, sisanya malam.
export function sapaan(jam: number): Sapaan {
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

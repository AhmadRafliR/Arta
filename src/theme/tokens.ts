export type Mode = 'terang' | 'gelap';
export type Pref = 'sistem' | Mode;

export type Tokens = {
  bg: string;
  card: string;
  card2: string;
  fg: string;
  fg2: string;
  mid: string;
  line: string;
  acc: string;
  accInk: string;
  accFg: string;
  heroFrom: string;
  heroTo: string;
  heroFg: string;
  heroSub: string;
  /** Kartu saldo gaya e-wallet (Beranda): latar putih kebiruan, saldo tebal, tombol aksi berikon. */
  kartuFrom: string;
  kartuTo: string;
  kartuFg: string;
  kartuSub: string;
  kartuLine: string;
  /** Petak ikon tombol aksi di kartu saldo. */
  aksiBg: string;
  aksiFg: string;
  /** Ilustrasi keadaan kosong (docs/design/arta/empty-*.svg). */
  ilusTintFrom: string;
  ilusTintTo: string;
  ilusOnTint: string;
  ilusAksen: string;
  ilusGaris: string;
  warn: string;
  warnInk: string;
  danger: string;
  dangerInk: string;
};

export const tokens: Record<Mode, Tokens> = {
  terang: {
    bg: '#EEF3F5',
    card: '#FFFFFF',
    card2: '#F6FAFB',
    fg: '#0B424F',
    fg2: '#47646B',
    mid: '#52727A',
    line: '#DDE7EA',
    acc: '#52C3BF',
    accInk: '#17726F',
    accFg: '#08343D',
    heroFrom: '#0B424F',
    heroTo: '#1F6A76',
    heroFg: '#FFFFFF',
    heroSub: 'rgba(255,255,255,0.74)',
    kartuFrom: '#FFFFFF',
    kartuTo: '#E3F1F5',
    kartuFg: '#0B424F',
    kartuSub: '#52727A',
    kartuLine: '#DDE7EA',
    aksiBg: '#178F8B',
    aksiFg: '#FFFFFF',
    ilusTintFrom: '#0B424F',
    ilusTintTo: '#1F6A76',
    ilusOnTint: '#FFFFFF',
    ilusAksen: '#52C3BF',
    ilusGaris: '#5B7C84',
    warn: '#E0A93B',
    warnInk: '#8A5A00',
    danger: '#D95C5C',
    dangerInk: '#A32B2B',
  },
  gelap: {
    bg: '#0B0B0C',
    card: '#161618',
    card2: '#1D1D20',
    fg: '#FFFFFF',
    fg2: '#B9B9BF',
    mid: '#8A8A8F',
    line: '#26262A',
    acc: '#C6F432',
    accInk: '#C6F432',
    accFg: '#0B0B0C',
    heroFrom: '#FFFFFF',
    heroTo: '#FFFFFF',
    heroFg: '#0B0B0C',
    heroSub: 'rgba(11,66,79,0.78)',
    kartuFrom: '#1D1D20',
    kartuTo: '#14262A',
    kartuFg: '#FFFFFF',
    kartuSub: '#B9B9BF',
    kartuLine: '#26262A',
    aksiBg: '#C6F432',
    aksiFg: '#0B0B0C',
    ilusTintFrom: '#F2F7F8',
    ilusTintTo: '#CFDDE1',
    ilusOnTint: '#0B424F',
    ilusAksen: '#1F6A76',
    ilusGaris: '#8A8A8F',
    warn: '#E9C46A',
    warnInk: '#E9C46A',
    danger: '#FF8A8A',
    dangerInk: '#FF8A8A',
  },
};

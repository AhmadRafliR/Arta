export type Mode = 'terang' | 'gelap';
export type Pref = 'sistem' | Mode;

export type Tokens = {
  bg: string;
  card: string;
  fg: string;
  mid: string;
  line: string;
  acc: string;
  accFg: string;
  heroFrom: string;
  heroTo: string;
  heroFg: string;
};

export const tokens: Record<Mode, Tokens> = {
  terang: {
    bg: '#EEF3F5',
    card: '#FFFFFF',
    fg: '#0B424F',
    mid: '#5B7C84',
    line: '#DDE7EA',
    acc: '#52C3BF',
    accFg: '#0B424F',
    heroFrom: '#0B424F',
    heroTo: '#1F6A76',
    heroFg: '#FFFFFF',
  },
  gelap: {
    bg: '#0B0B0C',
    card: '#161618',
    fg: '#FFFFFF',
    mid: '#8A8A8F',
    line: '#26262A',
    acc: '#C6F432',
    accFg: '#0B0B0C',
    heroFrom: '#FFFFFF',
    heroTo: '#FFFFFF',
    heroFg: '#0B0B0C',
  },
};

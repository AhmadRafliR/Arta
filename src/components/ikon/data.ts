// DIHASILKAN oleh scripts/gen-ikon.mjs dari docs/design/arta/icons.json.
// Jangan diedit tangan; jalankan `npm run gen:ikon`.

export type Elemen = {
  tag: 'path' | 'circle' | 'rect';
  kelas: 'ln' | 'fill';
  attr: Record<string, string>;
};

export type NamaIkon =
  | 'nav-beranda'
  | 'nav-riwayat'
  | 'nav-mic'
  | 'nav-hutang'
  | 'nav-akun'
  | 'wallet-harian'
  | 'wallet-darurat'
  | 'wallet-investasi'
  | 'cat-rokok'
  | 'cat-makan'
  | 'cat-parkir'
  | 'cat-kuliah'
  | 'cat-transport'
  | 'cat-ortu'
  | 'cat-gaji'
  | 'cat-lainnya'
  | 'status-budget-aman'
  | 'status-budget-waspada'
  | 'status-budget-lewat'
  | 'status-jatuh-tempo'
  | 'status-lunas'
  | 'status-kuota'
  | 'act-mic'
  | 'act-ketik'
  | 'act-simpan'
  | 'act-hapus'
  | 'act-ubah'
  | 'act-ekspor'
  | 'ui-back'
  | 'ui-off'
  | 'ui-swap'
  | 'ui-chev-left'
  | 'ui-chev-right'
  | 'ui-arrow-up'
  | 'ui-arrow-down'
  | 'ui-close'
  | 'ui-note'
  | 'ui-money'
  | 'ui-check'
  | 'ui-percent'
  | 'ui-bell'
  | 'ui-lock'
  | 'ui-plus'
  | 'ui-trend-up'
  | 'ui-trend-down'
  | 'tipe-saham'
  | 'tipe-reksa'
  | 'tipe-kripto'
  | 'tipe-emas'
  | 'ui-ekspor'
  | 'ui-shield'
  | 'ui-budget'
  | 'ui-chev'
  | 'ui-gear'
  | 'ui-archive'
  | 'ui-logout'
  | 'ui-privacy'
  | 'ui-alert'
  | 'ui-tukar';

export const IKON: Record<NamaIkon, Elemen[]> = {
  'nav-beranda': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.5 10.4 L12 3.6 L20.5 10.4 V19 A1.6 1.6 0 0 1 18.9 20.6 H15 V14.2 H9 V20.6 H5.1 A1.6 1.6 0 0 1 3.5 19 Z' } },
  ],
  'nav-riwayat': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 7.6 V12.2 L15.4 14.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 5.2 V8.9 H8.3' } },
  ],
  'nav-mic': [
    { tag: 'rect', kelas: 'ln', attr: { x: '9.1', y: '3.4', width: '5.8', height: '10', rx: '2.9' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M5.8 11.4 A6.2 6.2 0 0 0 18.2 11.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 17.6 V20.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9 20.6 H15' } },
  ],
  'nav-hutang': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3.2', y: '6.2', width: '17.6', height: '12.6', rx: '2.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.2 10.2 H20.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M16.4 14.9 H17.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.6 3.4 L12 6.2 L17.4 3.4' } },
  ],
  'nav-akun': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '8.4', r: '3.9' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 20.4 C4.6 16.2 7.9 13.9 12 13.9 C16.1 13.9 19.4 16.2 19.4 20.4' } },
  ],
  'wallet-harian': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3', y: '6', width: '18', height: '13', rx: '2.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M15.4 12.5 H20.4 V16.1 H15.4 A1.8 1.8 0 0 1 15.4 12.5 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.6 6 V4.2 A1.4 1.4 0 0 1 8.6 2.9 L17.8 4.7 A1.4 1.4 0 0 1 18.9 6' } },
  ],
  'wallet-darurat': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 2.9 L19.4 6.3 V11.8 C19.4 16.6 16.2 19.9 12 21.3 C7.8 19.9 4.6 16.6 4.6 11.8 V6.3 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 8.2 V15.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.3 11.9 H15.7' } },
  ],
  'wallet-investasi': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M3 20.2 H21' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 16.4 L9.4 11.4 L13 14.2 L20.2 6.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M15.6 6.2 H20.6 V11.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 20.2 V18.8' } },
  ],
  'cat-rokok': [
    { tag: 'rect', kelas: 'ln', attr: { x: '2.8', y: '12.6', width: '18.4', height: '6.6', rx: '1.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10.4 12.6 V19.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M16.8 12.6 V19.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M15.2 9 V7.2 A2.2 2.2 0 0 0 13 5' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M18.6 9 V7.2 A2.2 2.2 0 0 0 16.4 5' } },
  ],
  'cat-makan': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.2 2.8 V10.4 M5.2 2.8 V7.2 A3 3 0 0 0 8.2 10.2 A3 3 0 0 0 11.2 7.2 V2.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.2 10.4 V21.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M16.4 2.8 C14.4 2.8 13.4 5.4 13.4 8.6 C13.4 10.8 14.2 12 15.6 12.2 V21.2' } },
  ],
  'cat-parkir': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.6 16.6 V7.4 H13.4 A3 3 0 0 1 13.4 13.4 H9.6' } },
  ],
  'cat-kuliah': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.4 L21 7.6 L12 11.8 L3 7.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 9.9 V14.8 C6.4 16.6 8.9 18 12 18 C15.1 18 17.6 16.6 17.6 14.8 V9.9' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M21 7.6 V13.2' } },
  ],
  'cat-transport': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.4 15.6 V12.2 L5.8 7.6 A1.8 1.8 0 0 1 7.4 6.6 H16.6 A1.8 1.8 0 0 1 18.2 7.6 L20.6 12.2 V15.6 A1.2 1.2 0 0 1 19.4 16.8 H4.6 A1.2 1.2 0 0 1 3.4 15.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.4 12.2 H20.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.2 16.8 V19.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M16.8 16.8 V19.4' } },
  ],
  'cat-ortu': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 8.1 C10.2 5.9 6.8 8.6 8.2 11.4 C9 13 12 15.1 12 15.1 C12 15.1 15 13 15.8 11.4 C17.2 8.6 13.8 5.9 12 8.1 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.2 14.6 H7.4 L10.4 17.2 H13.2 A1.5 1.5 0 0 1 13.2 20.2 H10.2 L5.4 18.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M20.8 14.6 H17.2' } },
  ],
  'cat-gaji': [
    { tag: 'rect', kelas: 'ln', attr: { x: '2.8', y: '6.2', width: '18.4', height: '11.6', rx: '2.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M2.8 9.6 H21.2' } },
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '14', r: '2.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6 12.8 V15.4 M18 12.8 V15.4' } },
  ],
  'cat-lainnya': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3.2', y: '4.6', width: '17.6', height: '14.8', rx: '3.4' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '7.8', cy: '12', r: '1.05' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '12', r: '1.05' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '16.2', cy: '12', r: '1.05' } },
  ],
  'status-budget-aman': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.9 12.3 L10.8 15.2 L16.2 9.4' } },
  ],
  'status-budget-waspada': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 7.3 V13.1' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '16.3', r: '1.05' } },
  ],
  'status-budget-lewat': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.6 8.6 L15.4 15.4 M15.4 8.6 L8.6 15.4' } },
  ],
  'status-jatuh-tempo': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3.4', y: '5.4', width: '17.2', height: '15.2', rx: '2.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.4 9.6 H20.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8 3.4 V6.8 M16 3.4 V6.8' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '15.1', r: '1.5' } },
  ],
  'status-lunas': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.8 12.2 L10.7 15.1 L16.4 9' } },
  ],
  'status-kuota': [
    { tag: 'rect', kelas: 'ln', attr: { x: '2.6', y: '7.4', width: '16.4', height: '9.2', rx: '2.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M21.4 10.6 V13.4' } },
    { tag: 'rect', kelas: 'fill', attr: { x: '4.8', y: '9.6', width: '6.4', height: '4.8', rx: '1.2' } },
  ],
  'act-mic': [
    { tag: 'rect', kelas: 'ln', attr: { x: '9.1', y: '3.4', width: '5.8', height: '10', rx: '2.9' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M5.8 11.4 A6.2 6.2 0 0 0 18.2 11.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 17.6 V20.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9 20.6 H15' } },
  ],
  'act-ketik': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.4 19.6 L4.9 16.2 L15.6 5.5 A2.2 2.2 0 0 1 18.7 5.5 L18.7 5.5 A2.2 2.2 0 0 1 18.7 8.6 L8 19.3 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M14.2 6.9 L17.3 10' } },
  ],
  'act-simpan': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 3.6 H15.4 L20.4 8.6 V18 A2.4 2.4 0 0 1 18 20.4 H6.4 A2.4 2.4 0 0 1 4 18 V6 A2.4 2.4 0 0 1 6.4 3.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.6 3.6 V9 H15 V3.6' } },
    { tag: 'rect', kelas: 'ln', attr: { x: '7.2', y: '13.4', width: '9.6', height: '7', rx: '1.4' } },
  ],
  'act-hapus': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 6.6 H19.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9 6.6 V4.8 A1.4 1.4 0 0 1 10.4 3.4 H13.6 A1.4 1.4 0 0 1 15 4.8 V6.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 6.6 L7.3 19.2 A1.8 1.8 0 0 0 9.1 20.9 H14.9 A1.8 1.8 0 0 0 16.7 19.2 L17.6 6.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10.4 10.4 V17.2 M13.6 10.4 V17.2' } },
  ],
  'act-ubah': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.4 19.6 L4.9 15.8 L15.8 4.9 A2.4 2.4 0 0 1 19.2 8.2 L8.2 19.1 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M14 6.7 L17.3 10' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12.6 20.4 H20' } },
  ],
  'act-ekspor': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 13.8 V18.6 A2 2 0 0 0 6.6 20.6 H17.4 A2 2 0 0 0 19.4 18.6 V13.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.2 V14.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.8 7.4 L12 3.2 L16.2 7.4' } },
  ],
  'ui-back': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M15 4.5 L7.5 12 L15 19.5' } },
  ],
  'ui-off': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.2 6.2 L17.8 17.8' } },
  ],
  'ui-swap': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 4.5 V19.5' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.5 15 L12 19.5 L16.5 15' } },
  ],
  'ui-chev-left': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M14.5 5.5 L8 12 L14.5 18.5' } },
  ],
  'ui-chev-right': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.5 5.5 L16 12 L9.5 18.5' } },
  ],
  'ui-arrow-up': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 19.2 V4.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 10.4 L12 4.8 L17.6 10.4' } },
  ],
  'ui-arrow-down': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 4.8 V19.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 13.6 L12 19.2 L17.6 13.6' } },
  ],
  'ui-close': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.6 6.6 L17.4 17.4 M17.4 6.6 L6.6 17.4' } },
  ],
  'ui-note': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 5.4 H19.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 10.2 H19.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 15 H14.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 19.2 H11' } },
  ],
  'ui-money': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3', y: '6.4', width: '18', height: '11.2', rx: '2.6' } },
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '2.7' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.6 9.4 V14.6 M17.4 9.4 V14.6' } },
  ],
  'ui-check': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M5.4 12.4 L9.8 16.8 L18.6 7.2' } },
  ],
  'ui-percent': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M18.4 5.6 L5.6 18.4' } },
    { tag: 'circle', kelas: 'ln', attr: { cx: '7.8', cy: '7.8', r: '2.6' } },
    { tag: 'circle', kelas: 'ln', attr: { cx: '16.2', cy: '16.2', r: '2.6' } },
  ],
  'ui-bell': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.6 10.4 A5.4 5.4 0 0 1 17.4 10.4 V14.6 L19.2 17.6 H4.8 L6.6 14.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10 20 C10.6 21 13.4 21 14 20' } },
  ],
  'ui-lock': [
    { tag: 'rect', kelas: 'ln', attr: { x: '4.6', y: '10.2', width: '14.8', height: '10.4', rx: '2.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.2 10.2 V7.6 A3.8 3.8 0 0 1 15.8 7.6 V10.2' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '15.4', r: '1.3' } },
  ],
  'ui-plus': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 5.4 V18.6 M5.4 12 H18.6' } },
  ],
  'ui-trend-up': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 16.4 L9.6 11.4 L12.8 13.9 L19.4 7.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M15.2 7.4 H19.6 V11.8' } },
  ],
  'ui-trend-down': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 7.6 L9.6 12.6 L12.8 10.1 L19.4 16.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M15.2 16.6 H19.6 V12.2' } },
  ],
  'tipe-saham': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M3.4 20.4 H20.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.2 20.4 V13.2 M12 20.4 V7.6 M16.8 20.4 V15.8' } },
  ],
  'tipe-reksa': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.8 V12 L18.2 16.1' } },
  ],
  'tipe-kripto': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.6 8.4 H13.1 A1.9 1.9 0 0 1 13.1 12.2 H9.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.6 12.2 H13.5 A1.9 1.9 0 0 1 13.5 16 H9.6 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M11.1 6.6 V8.4 M11.1 16 V17.8' } },
  ],
  'tipe-emas': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M7.2 9.8 H16.8 L19.2 18.6 H4.8 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.4 9.8 L10.8 5.4 H13.2 L14.6 9.8' } },
  ],
  'ui-ekspor': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.8 V14.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.2 10.4 L12 14.2 L15.8 10.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.6 16.6 V18.6 A1.8 1.8 0 0 0 6.4 20.4 H17.6 A1.8 1.8 0 0 0 19.4 18.6 V16.6' } },
  ],
  'ui-shield': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.2 L19.4 6.2 V12 C19.4 16.4 16.2 19.4 12 20.8 C7.8 19.4 4.6 16.4 4.6 12 V6.2 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 9.2 V15 M9.2 12.1 H14.8' } },
  ],
  'ui-budget': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '8.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M8.2 12.2 L11 15 L16 9.4' } },
  ],
  'ui-chev': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M9.6 5.6 L16 12 L9.6 18.4' } },
  ],
  'ui-gear': [
    { tag: 'circle', kelas: 'ln', attr: { cx: '12', cy: '12', r: '3.1' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.4 V5.6 M12 18.4 V20.6 M4.4 12 H6.6 M17.4 12 H19.6 M6.6 6.6 L8.2 8.2 M15.8 15.8 L17.4 17.4 M17.4 6.6 L15.8 8.2 M8.2 15.8 L6.6 17.4' } },
  ],
  'ui-archive': [
    { tag: 'rect', kelas: 'ln', attr: { x: '3.6', y: '4.6', width: '16.8', height: '4.4', rx: '1.4' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M5.2 9 V18.4 A1.6 1.6 0 0 0 6.8 20 H17.2 A1.6 1.6 0 0 0 18.8 18.4 V9' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10 12.6 H14' } },
  ],
  'ui-logout': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M13.6 4.6 H18.2 A1.6 1.6 0 0 1 19.8 6.2 V17.8 A1.6 1.6 0 0 1 18.2 19.4 H13.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10 8.4 L6.2 12 L10 15.6' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M6.4 12 H15.2' } },
  ],
  'ui-privacy': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 3.2 L19.4 6.2 V12 C19.4 16.4 16.2 19.4 12 20.8 C7.8 19.4 4.6 16.4 4.6 12 V6.2 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 10.2 V14.6' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '8.2', r: '1' } },
  ],
  'ui-alert': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 4.2 L20.6 19.4 H3.4 Z' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M12 9.6 V14.2' } },
    { tag: 'circle', kelas: 'fill', attr: { cx: '12', cy: '16.8', r: '1' } },
  ],
  'ui-tukar': [
    { tag: 'path', kelas: 'ln', attr: { d: 'M4.2 9.2 H17.2' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M13.4 5.4 L17.2 9.2 L13.4 13' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M19.8 15.4 H6.8' } },
    { tag: 'path', kelas: 'ln', attr: { d: 'M10.6 11.6 L6.8 15.4 L10.6 19.2' } },
  ],
};

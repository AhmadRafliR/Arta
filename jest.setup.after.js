// Dijalankan setelah kerangka uji terpasang (perlu agar RNTL tetap mendaftarkan cleanup otomatis).
const { configure } = require('@testing-library/react-native');

// Jalankan dingin (cache transform kosong) bisa lambat; beri waktu lebih untuk findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });

// Reanimated 4: resolver di package.json memuat implementasi web; ini memasang timer animasi untuk jest.
require('react-native-reanimated').setUpTests();

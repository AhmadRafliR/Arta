// Dijalankan setelah kerangka uji terpasang (perlu agar RNTL tetap mendaftarkan cleanup otomatis).
const { configure } = require('@testing-library/react-native');

// Jalankan dingin (cache transform kosong) bisa lambat; beri waktu lebih untuk findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });

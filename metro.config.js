const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });

// react-native-purchases selalu memuat implementasi browser (paket UMD ~0,7 MB) saat diimpor, padahal di
// Android/iOS yang dipakai modul native. Di luar web, modul browser itu diganti modul kosong supaya bundle
// lebih kecil dan app lebih cepat dibuka. Hanya dipakai bila modul native tidak ada (Expo Go / web).
const resolveAsli = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    moduleName === './browser/nativeModule' &&
    context.originModulePath.split(path.sep).join('/').endsWith('react-native-purchases/dist/purchases.js')
  ) {
    return { type: 'empty' };
  }
  return resolveAsli ? resolveAsli(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

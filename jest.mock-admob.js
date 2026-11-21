// Pengganti modul native AdMob untuk Jest (dipakai lewat jest.setup.js).
const React = require('react');
const { View } = require('react-native');

module.exports = {
  __esModule: true,
  default: () => ({
    initialize: jest.fn(async () => []),
    setRequestConfiguration: jest.fn(async () => undefined),
  }),
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ canRequestAds: true })),
    showPrivacyOptionsForm: jest.fn(async () => undefined),
  },
  MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
  TestIds: {
    ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
    REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  },
  AdEventType: { ERROR: 'error', CLOSED: 'closed', LOADED: 'loaded' },
  RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' },
  RewardedAd: { createForAdRequest: jest.fn() },
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  BannerAd: (props) => React.createElement(View, Object.assign({ testID: 'banner-ad' }, props)),
};

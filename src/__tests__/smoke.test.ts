test('alias @ jalan', () => {
  const { APP_NAME } = require('@/config');
  expect(APP_NAME).toBe('keuangan-app');
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: { sans: ['NunitoSans'] },
      colors: {
        bg: 'var(--color-bg)',
        card: 'var(--color-card)',
        fg: 'var(--color-fg)',
        mid: 'var(--color-mid)',
        line: 'var(--color-line)',
        acc: 'var(--color-acc)',
        card2: 'var(--color-card2)',
        fg2: 'var(--color-fg2)',
        accink: 'var(--color-accink)',
        warn: 'var(--color-warn)',
        warnink: 'var(--color-warnink)',
        danger: 'var(--color-danger)',
        dangerink: 'var(--color-dangerink)',
        accsoft: 'var(--color-accsoft)',
        dangersoft: 'var(--color-dangersoft)',
        warnbg: 'var(--color-warnbg)',
        segactive: 'var(--color-segactive)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
};

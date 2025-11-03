import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-navy': '#1A3A52',
        'brand-cyan': '#A8E6E8',
        'brand-purple': '#7C3AED',
        'brand-teal': '#06B6D4',
        'brand-pink': '#EC4899',
        'brand-blue': '#3B82F6',
        'brand-dark-teal': '#0D9488',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};

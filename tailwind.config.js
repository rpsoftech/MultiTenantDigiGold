/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './packages/apps/*/src/**/*.{html,ts}',
    './packages/libs/*/src/**/*.{html,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

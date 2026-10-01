// Tailwind runs only to build its theme and utilities layers into src/app/globals.css; the
// site itself stays hand-written CSS. A local config keeps todox free of an @beep/ui dependency.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

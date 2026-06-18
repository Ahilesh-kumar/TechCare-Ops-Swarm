/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        google: {
          blue: "#1a73e8",
          blueHover: "#1557b0",
          blueLight: "#f4f8fe",
          blueLightBorder: "#d2e3fc",
          charcoal: "#202124",
          muted: "#5f6368",
          bgLight: "#f8f9fa",
          borderLight: "#dadce0",
          amber: "#f9ab00",
          green: "#1e8e3e",
          graySidebar: "#f1f3f4",
        }
      },
    },
  },
  plugins: [],
};

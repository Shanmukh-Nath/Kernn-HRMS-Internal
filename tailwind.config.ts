import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf2f2",
          100: "#fde8e8",
          200: "#fbd5d5",
          300: "#f8b4b4",
          400: "#f98080",
          500: "#c82b2f",
          600: "#a92427", // Official Kernn Primary Red
          700: "#8e1d20",
          800: "#74171a",
          900: "#5a1113",
          950: "#3b0b0c",
        },
        kernn: {
          red: "#a92427",
          dark: "#1e1e24",
          card: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;

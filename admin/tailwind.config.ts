import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#338dfc",
          600: "#1d6ef1",
          700: "#1558de",
          800: "#1847b4",
          900: "#193f8d",
          950: "#142856",
        },
        sidebar: {
          bg: "#1e293b",
          hover: "#334155",
          active: "#0f172a",
          text: "#cbd5e1",
          "text-active": "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;

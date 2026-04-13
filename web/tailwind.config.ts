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
          50: "#FFF5EB",
          100: "#FFE8D0",
          200: "#FFD1A1",
          300: "#FFBA72",
          400: "#FFA643",
          500: "#FF922E",
          600: "#E07A1F",
          700: "#C06415",
          800: "#9A4F10",
          900: "#7A3E0D",
        },
        secondary: {
          50: "#EDFAF6",
          100: "#D0F3EA",
          200: "#A3E8D6",
          300: "#6EDCBF",
          400: "#4DD4B1",
          500: "#37CEB3",
          600: "#2BB097",
          700: "#22917C",
          800: "#1A7363",
          900: "#135A4D",
        },
        accent: {
          50: "#FEF3E6",
          100: "#FDDDB3",
          200: "#FCC780",
          300: "#FBB14D",
          400: "#FAA226",
          500: "#F69421",
          600: "#D67E00",
          700: "#B36900",
          800: "#905400",
          900: "#6D3F00",
        },
        success: {
          500: "#22c55e",
          600: "#16a34a",
        },
        danger: {
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Roboto", "sans-serif"],
      },
      keyframes: {
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "count-up": "count-up 0.6s ease-out forwards",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-in-left": "slide-in-left 0.6s ease-out forwards",
        "slide-in-right": "slide-in-right 0.6s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;

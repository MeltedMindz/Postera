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
        bg: {
          DEFAULT: "#0a0a0a",
          card: "#111111",
          elevated: "#1a1a1a",
          deep: "#0d0d0d",
        },
        text: {
          primary: "#e5e5e5",
          secondary: "#a3a3a3",
          muted: "#737373",
          disabled: "#525252",
        },
        border: {
          DEFAULT: "#262626",
          strong: "#333333",
          active: "#404040",
        },
        accent: {
          slate: "#64748b",
          stone: "#78716c",
          gray: "#6b7280",
          lime: "#84cc16",
          red: "#ef4444",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Fira Code",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

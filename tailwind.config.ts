import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chrome: {
          50: "#f5f7fb",
          100: "#e6ecf5",
          200: "#c6d2e6",
          300: "#9aacca",
          400: "#6b81a8",
          500: "#4a608c",
          900: "#0a0f1f",
        },
        bubblegum: "#ff5ec4",
        cyber: "#00e5ff",
        lime: "#c6ff3d",
        sunset: "#ffb547",
        violet: "#8b5cf6",
      },
      fontFamily: {
        display: ['"VT323"', "monospace"],
        mono: ['"Space Mono"', "monospace"],
        body: ['"Chakra Petch"', "sans-serif"],
      },
      boxShadow: {
        chunk: "6px 6px 0 0 rgba(0,0,0,1)",
        "chunk-sm": "4px 4px 0 0 rgba(0,0,0,1)",
        "chunk-lg": "10px 10px 0 0 rgba(0,0,0,1)",
        "chunk-cyber": "6px 6px 0 0 #00e5ff",
        "chunk-pink": "6px 6px 0 0 #ff5ec4",
        gloss: "inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.2)",
      },
      backgroundImage: {
        "grid-light":
          "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
        holo: "linear-gradient(120deg, #ff5ec4 0%, #8b5cf6 25%, #00e5ff 50%, #c6ff3d 75%, #ffb547 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;

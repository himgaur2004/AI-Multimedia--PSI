/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f3ee",
        panel: "#ffffff",
        line: "#e6e1d8",
        ink: "#1c1a17",
        sub: "#7a746a",
        accent: {
          DEFAULT: "#a1401e",
          soft: "#f4e3da",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Sora", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

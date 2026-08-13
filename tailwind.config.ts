import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6f7e1",
          500: "#22a35d",
          600: "#178a4b",
          700: "#136e3c",
        },
      },
    },
  },
  plugins: [],
};

export default config;

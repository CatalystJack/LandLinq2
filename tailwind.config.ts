import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        'catalyst-navy': "var(--catalyst-navy)",
        'catalyst-blue': "var(--catalyst-blue)",
        'catalyst-gold': "var(--catalyst-gold)",
        'catalyst-gray': {
          50: "var(--catalyst-gray-50)",
          100: "var(--catalyst-gray-100)",
          200: "var(--catalyst-gray-200)",
          300: "var(--catalyst-gray-300)",
          400: "var(--catalyst-gray-400)",
          500: "var(--catalyst-gray-500)",
          600: "var(--catalyst-gray-600)",
          700: "var(--catalyst-gray-700)",
          800: "var(--catalyst-gray-800)",
          900: "var(--catalyst-gray-900)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "slide-in-from-left": {
          "0%": {
            opacity: "0",
            transform: "translateX(-80px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in": "slide-in-from-left 0.6s ease-out forwards",
        "slide-in-delay-1": "slide-in-from-left 0.6s ease-out 0.4s forwards",
        "slide-in-delay-2": "slide-in-from-left 0.6s ease-out 0.8s forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // One neutral family, cool/navy-tinted, used for every bit of chrome —
        // background, borders, text — instead of mixing Tailwind's slate
        // (cool) and stone (warm). Ties to the overnight/ink theme: ink-950
        // is the "night" end, ink-50 the "page" end, same hue throughout.
        ink: {
          50: "#f5f6f8",
          100: "#e9ebef",
          200: "#d3d7e0",
          300: "#b0b6c4",
          400: "#8790a3",
          500: "#666f85",
          600: "#4f5769",
          700: "#3c4254",
          800: "#282c3a",
          900: "#1a1d27",
          950: "#10121a",
        },
        // Warm brass/ochre accent — a hand-tuned amber rather than Tailwind's
        // stock amber-500, read as lamplight against an overnight shift
        // rather than a generic SaaS blue or candy orange.
        accent: {
          100: "#f7e7d4",
          300: "#e8b87d",
          500: "#d98826",
          600: "#af6d1d",
          700: "#855214",
        },
        // Semantic status colors for the swap/cycle lifecycle ("open" has no
        // entry — it's a non-event, styled straight off the ink neutral
        // scale). The other three each sit in their own hue family verified
        // (via actual HSL deltas, not eyeballed) to stay clear of the 8
        // categorical identity hues in src/lib/user-color.ts — status pills
        // always carry a text label too, so they only need to read as
        // distinct tokens, not occupy untouched hue territory.
        mutual: { 100: "#f1ecd0", 400: "#96842c", 700: "#625618" },
        approved: { 100: "#daf1ed", 400: "#1f7a6b", 700: "#145d50" },
        denied: { 100: "#f4dcd7", 400: "#ab402b", 700: "#762819" },
      },
      // Additive, explicit type steps with paired line-height for real
      // hierarchy — named by role, not by ad hoc text-sm/text-xl reaching.
      fontSize: {
        display: ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em" }],
        title: ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.005em" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        label: ["0.8125rem", { lineHeight: "1.25rem" }],
        caption: ["0.75rem", { lineHeight: "1.125rem" }],
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      // One deliberate container radius instead of the default rounded-md
      // used ad hoc everywhere. rounded-full stays separate — that's a shape
      // choice (pills, avatars), not a corner-radius decision.
      borderRadius: {
        card: "0.625rem",
      },
      keyframes: {
        "drag-lift": {
          "0%": { transform: "scale(1)", boxShadow: "0 1px 2px rgba(16,18,26,0.08)" },
          "100%": { transform: "scale(1.06)", boxShadow: "0 12px 24px rgba(16,18,26,0.22)" },
        },
        "drop-settle": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "status-change": {
          "0%": { transform: "scale(0.94)", opacity: "0.4" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "drag-lift": "drag-lift 150ms ease-out forwards",
        "drop-settle": "drop-settle 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "status-change": "status-change 220ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        game: {
          bg: '#0b0f19',
          panel: '#111827',
          border: '#1f2937',
          text: '#e2e8f0',
          dim: '#94a3b8',
          gold: '#f59e0b',
          hp: '#ef4444',
          mana: '#3b82f6',
          xp: '#f59e0b',
          success: '#22c55e',
        },
      },
      boxShadow: {
        glow: '0 0 12px rgba(245, 158, 11, 0.25)',
      },
    },
  },
  plugins: [],
}


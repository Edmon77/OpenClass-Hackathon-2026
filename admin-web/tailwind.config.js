/** @type {import('tailwindcss').Config} */
/** Semantic colors aligned with `lecture-room-status/src/theme/tokens.ts` */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        ios: '14px',
        'ios-lg': '20px',
        'ios-xl': '28px',
      },
      colors: {
        app: {
          page: '#F2F2F7',
          card: '#FFFFFF',
          secondary: '#F2F2F7',
          tertiary: '#FFFFFF',
          label: '#000000',
          muted: 'rgba(60, 60, 67, 0.6)',
          subtle: 'rgba(60, 60, 67, 0.3)',
          separator: 'rgba(60, 60, 67, 0.12)',
          accent: '#007AFF',
          'accent-muted': 'rgba(0, 122, 255, 0.12)',
          campus: '#1C7C54',
          'campus-muted': 'rgba(28, 124, 84, 0.12)',
          destructive: '#FF3B30',
          fill: 'rgba(120, 120, 128, 0.12)',
          success: '#34C759',
          warn: '#FF9F0A',
          overlay: 'rgba(0, 0, 0, 0.45)',
        },
      },
    },
  },
  plugins: [],
};

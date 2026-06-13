/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ProPresenter-style dark palette
        forge: {
          black: '#0a0a0b',
          900: '#121214',
          800: '#1a1a1d',
          700: '#242428',
          600: '#2e2e34',
          500: '#3a3a42',
          400: '#52525b',
          accent: '#3b82f6',
          accentHover: '#2563eb'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
}

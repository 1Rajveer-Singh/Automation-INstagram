/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FFFDF5',
        slateDark: '#1E293B',
        violetBrand: '#8B5CF6',
        pinkPop: '#F472B6',
        yellowPop: '#FBBF24',
        mintPop: '#34D399',
        borderDark: '#1E293B',
      },
      fontFamily: {
        heading: ['"Outfit"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pop-sm': '2px 2px 0px 0px #1E293B',
        'pop': '4px 4px 0px 0px #1E293B',
        'pop-md': '6px 6px 0px 0px #1E293B',
        'pop-lg': '8px 8px 0px 0px #1E293B',
        'pop-pink': '6px 6px 0px 0px #F472B6',
        'pop-yellow': '6px 6px 0px 0px #FBBF24',
        'pop-mint': '6px 6px 0px 0px #34D399',
        'pop-violet': '6px 6px 0px 0px #8B5CF6',
      },
      borderRadius: {
        'blob': '24px 24px 24px 0px',
        'blob-alt': '0px 24px 24px 24px',
        'arch': '9999px 9999px 0px 0px',
      },
      animation: {
        'wiggle': 'wiggle 2s ease-in-out infinite',
        'pop-in': 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(2deg)' },
          '75%': { transform: 'rotate(-2deg)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.9) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
}

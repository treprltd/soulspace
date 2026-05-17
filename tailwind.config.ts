import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#08111C',
        ink2: '#0F1E2E',
        ink3: '#162638',
        gold: '#C9A84C',
        gold2: '#E8C97A',
        gold3: '#F5DFA0',
        sand: '#F5EDD8',
        sand2: '#FAF7F0',
        teal: '#2A8C7A',
        teal2: '#3DAF96',
        mist: '#8BA7B8',
        danger: '#D44040',
        winter: '#6B8CAE',
        spring: '#2A8C7A',
        summer: '#C9A84C',
        autumn: '#C4784A',
      },
      fontFamily: {
        // CSS variables injected by next/font (self-hosted); fall back to
        // the quoted names so Tailwind purge still detects them if needed.
        serif: ['var(--font-cormorant)', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)',   '"DM Sans"',            'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

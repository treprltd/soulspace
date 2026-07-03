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
      // ── Extra-large type scale ────────────────────────────────────────────
      // Every named text-* utility is bumped up (rem-based, so it still scales
      // with the root font size and stays responsive). Kept in lockstep with
      // the hardcoded-px sizes elsewhere in the app: text-base = 21px matches
      // an inline 16px→21px bump, text-sm = 19px matches 14px→19px, etc.
      // Root is 16px, so 1rem = 16px for the conversions below.
      fontSize: {
        xs:   ['1.0625rem', { lineHeight: '1.5'  }], // 17px  (was 12)
        sm:   ['1.1875rem', { lineHeight: '1.55' }], // 19px  (was 14)
        base: ['1.3125rem', { lineHeight: '1.7'  }], // 21px  (was 16)
        lg:   ['1.4375rem', { lineHeight: '1.6'  }], // 23px  (was 18)
        xl:   ['1.5625rem', { lineHeight: '1.5'  }], // 25px  (was 20)
        '2xl':['1.875rem',  { lineHeight: '1.35' }], // 30px  (was 24)
        '3xl':['2.3125rem', { lineHeight: '1.25' }], // 37px  (was 30)
        '4xl':['2.75rem',   { lineHeight: '1.2'  }], // 44px  (was 36)
        '5xl':['3.5rem',    { lineHeight: '1.1'  }], // 56px  (was 48)
        '6xl':['4rem',      { lineHeight: '1.05' }], // 64px  (was 60)
      },
    },
  },
  plugins: [],
}

export default config

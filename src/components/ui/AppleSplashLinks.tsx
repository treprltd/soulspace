// Apple PWA launch (startup) images — one per device resolution, so an
// installed Soul Space opens straight into the ink+ring splash instead of a
// white flash. iOS matches on exact device-width/height + pixel-ratio, so
// every entry is device-specific. Portrait only (Apple's baseline).
//
// Rendered inside <head> from the root layout. Next.js hoists these <link>
// tags to <head>. Assets live in public/splash/ (generated to match this list).
//
// device px = w * r × h * r (must equal the filename in public/splash/).
const APPLE_SPLASH = [
  { w: 375, h: 667, r: 2, src: '/splash/splash-750x1334.png' },   // iPhone SE
  { w: 375, h: 812, r: 3, src: '/splash/splash-1125x2436.png' },  // iPhone X/11Pro/12mini
  { w: 390, h: 844, r: 3, src: '/splash/splash-1170x2532.png' },  // iPhone 12/13/14
  { w: 393, h: 852, r: 3, src: '/splash/splash-1179x2556.png' },  // iPhone 14Pro/15
  { w: 414, h: 896, r: 2, src: '/splash/splash-828x1792.png' },   // iPhone XR/11
  { w: 414, h: 896, r: 3, src: '/splash/splash-1242x2688.png' },  // iPhone XSMax/11ProMax
  { w: 428, h: 926, r: 3, src: '/splash/splash-1284x2778.png' },  // iPhone 13ProMax/14Plus
  { w: 430, h: 932, r: 3, src: '/splash/splash-1290x2796.png' },  // iPhone 15ProMax
  { w: 744, h: 1133, r: 2, src: '/splash/splash-1488x2266.png' }, // iPad mini
  { w: 768, h: 1024, r: 2, src: '/splash/splash-1536x2048.png' }, // iPad 9.7
  { w: 810, h: 1080, r: 2, src: '/splash/splash-1620x2160.png' }, // iPad 10.2
  { w: 820, h: 1180, r: 2, src: '/splash/splash-1640x2360.png' }, // iPad Air 10.9
  { w: 834, h: 1194, r: 2, src: '/splash/splash-1668x2388.png' }, // iPad Pro 11
  { w: 1024, h: 1366, r: 2, src: '/splash/splash-2048x2732.png' }, // iPad Pro 12.9
] as const

export function AppleSplashLinks() {
  return (
    <>
      {APPLE_SPLASH.map(({ w, h, r, src }) => (
        <link
          key={src}
          rel="apple-touch-startup-image"
          media={`(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          href={src}
        />
      ))}
    </>
  )
}

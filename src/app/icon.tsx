import { ImageResponse } from 'next/og'

// Soul Space favicon — 32×32 PNG generated at build time by Next.js
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#060E18',
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: '#C9A84C',
          fontFamily: 'serif',
        }}
      >
        ◎
      </div>
    ),
    { ...size }
  )
}

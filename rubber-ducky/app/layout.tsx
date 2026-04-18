import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DuckPad — ESP32-S2 Payload Builder',
  description: 'Remote HID payload builder and executor for ESP32-S2',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

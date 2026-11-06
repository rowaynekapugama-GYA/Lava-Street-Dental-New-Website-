import type { Metadata } from 'next'
import '@/dashboard/dashboard.css'
import { ToastProvider } from '@/dashboard/ui/Toast'
import { BRAND } from '@/dashboard/brand'

export const metadata: Metadata = {
  title: { default: `Dashboard | ${BRAND.name}`, template: `%s | ${BRAND.name} dashboard` },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: BRAND.favicon, type: 'image/svg+xml' }, { url: '/assets/icons/favicon-32.png', sizes: '32x32' }], apple: '/assets/icons/apple-touch-icon.png' },
}

export default function DashboardRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        {/* the website's own fonts (Inter and Roboto Condensed, as the site loads them) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Roboto+Condensed:wght@300;500&display=swap" rel="stylesheet" />
      </head>
      <body className="pd"><ToastProvider>{children}</ToastProvider></body>
    </html>
  )
}

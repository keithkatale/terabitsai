import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terabits AI",
  description: "AI-powered trading terminal with paper wallet, live market data, and generative analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}

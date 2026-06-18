import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Quant AI Workspace",
  description: "AI-Powered Financial Intelligence & Asset Analysis Workspace",
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

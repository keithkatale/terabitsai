import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { SupabaseConfigScript } from "@/components/supabase-config-script";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Terabits AI",
  description: "AI-powered trading terminal with paper wallet, live market data, and generative analysis",
  icons: {
    icon: "/benchmark-logo-black-bg.png",
    apple: "/benchmark-logo-black-bg.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className={dmSans.className}>
        <SupabaseConfigScript />
        {children}
      </body>
    </html>
  );
}

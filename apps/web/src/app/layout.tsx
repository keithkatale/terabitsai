import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { DataFastScript } from "@/components/datafast-script";
import { GoogleOAuthProviderWrapper } from "@/components/providers/google-oauth-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { PostHogConfigScript } from "@/components/posthog-config-script";
import { SupabaseConfigScript } from "@/components/supabase-config-script";

export const dynamic = "force-dynamic";

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
    icon: "/benchmark.png",
    apple: "/benchmark.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} overflow-x-clip`}>
      <body className={dmSans.className}>
        <DataFastScript />
        <SupabaseConfigScript />
        <PostHogConfigScript />
        <PostHogProvider>
          <GoogleOAuthProviderWrapper>{children}</GoogleOAuthProviderWrapper>
        </PostHogProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Terabits AI — AI-Powered Markets Terminal",
  description:
    "Research markets, analyze charts with AI vision, and trade with an autonomous wealth monitor — all in one terminal.",
  openGraph: {
    title: "Terabits AI — AI-Powered Markets Terminal",
    description:
      "Research markets, analyze charts with AI vision, and trade with an autonomous wealth monitor.",
    type: "website",
  },
};

export default function HomePage() {
  return <LandingPage />;
}

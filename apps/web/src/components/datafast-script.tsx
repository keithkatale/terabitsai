import Script from "next/script";

const DATAFAST_WEBSITE_ID =
  process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID ?? "dfid_Gm4iXErEaymGfrlQMMHEh";
const DATAFAST_DOMAIN =
  process.env.NEXT_PUBLIC_DATAFAST_DOMAIN ?? "terabitsai.com";

/** DataFast analytics — https://datafa.st/docs/nextjs-app-router */
export function DataFastScript() {
  if (!DATAFAST_WEBSITE_ID) return null;

  return (
    <Script
      data-website-id={DATAFAST_WEBSITE_ID}
      data-domain={DATAFAST_DOMAIN}
      src="https://datafa.st/js/script.js"
      strategy="afterInteractive"
    />
  );
}

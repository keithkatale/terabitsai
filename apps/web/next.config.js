/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy /chat → /app redirects
      { source: "/chat", destination: "/app", permanent: false },
      { source: "/chat/investing", destination: "/app/markets", permanent: false },
      { source: "/chat/signals", destination: "/app/markets", permanent: false },
      { source: "/chat/assets", destination: "/app/markets", permanent: false },
      { source: "/chat/news", destination: "/app/new", permanent: false },
      { source: "/chat/personal", destination: "/app/wallet", permanent: false },
      { source: "/chat/portfolio", destination: "/app/wallet", permanent: false },
      { source: "/chat/terminal", destination: "/app/markets", permanent: false },
      { source: "/chat/terminal/:path*", destination: "/app/markets", permanent: false },
      { source: "/chat/:path*", destination: "/app/:path*", permanent: false },

      // Aliases under /app
      { source: "/app/investing", destination: "/app/markets", permanent: false },
      { source: "/app/signals", destination: "/app/markets", permanent: false },
      { source: "/app/assets", destination: "/app/markets", permanent: false },
      { source: "/app/news", destination: "/app/new", permanent: false },
      { source: "/app/personal", destination: "/app/wallet", permanent: false },
      { source: "/app/portfolio", destination: "/app/wallet", permanent: false },
      { source: "/app/terminal", destination: "/app/markets", permanent: false },
      { source: "/app/terminal/:path*", destination: "/app/markets", permanent: false },

      // Legacy ?tab= query params on /app
      { source: "/app", has: [{ type: "query", key: "tab", value: "chat" }], destination: "/app/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "command" }], destination: "/app/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "assets" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "markets" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "news" }], destination: "/app/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "signals" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "investing" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "engine" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "home" }], destination: "/app/home", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "personal" }], destination: "/app/wallet", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "portfolio" }], destination: "/app/wallet", permanent: false },
    ];
  },
  transpilePackages: [
    "@quant/contracts",
    "@quant/db",
    "@quant/indicators",
    "@quant/market-intel",
    "@quant/mcp-server",
    "@quant/rag-engine",
  ],
  async rewrites() {
    const posthogHost =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    const assetsHost = posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com");

    return [
      {
        source: "/ingest/static/:path*",
        destination: `${assetsHost}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${assetsHost}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/**"],
  },
};

module.exports = nextConfig;

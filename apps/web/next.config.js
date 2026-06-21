/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/app/chat", destination: "/app?tab=command", permanent: false },
      { source: "/app/assets", destination: "/app?tab=command", permanent: false },
      { source: "/app/signals", destination: "/app?tab=command", permanent: false },
      { source: "/app/news", destination: "/app?tab=command", permanent: false },
      { source: "/app/personal", destination: "/app?tab=home", permanent: false },
      { source: "/app/portfolio", destination: "/app?tab=home", permanent: false },
      { source: "/app/investing", destination: "/app?tab=investing", permanent: false },
      { source: "/app/terminal", destination: "/app?tab=command", permanent: false },
      { source: "/app/terminal/:path*", destination: "/app?tab=command", permanent: false },
      // Legacy tab query params
      { source: "/app", has: [{ type: "query", key: "tab", value: "chat" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "assets" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "markets" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "news" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "signals" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "engine" }], destination: "/app?tab=command", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "personal" }], destination: "/app?tab=home", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "portfolio" }], destination: "/app?tab=home", permanent: false },
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
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/**"],
  },
};

module.exports = nextConfig;

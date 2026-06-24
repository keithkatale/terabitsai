/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/app/investing", destination: "/app/markets", permanent: false },
      { source: "/app/signals", destination: "/app/markets", permanent: false },
      { source: "/app/assets", destination: "/app/markets", permanent: false },
      { source: "/app/news", destination: "/app/chat", permanent: false },
      { source: "/app/personal", destination: "/app/wallet", permanent: false },
      { source: "/app/portfolio", destination: "/app/wallet", permanent: false },
      { source: "/app/home", destination: "/app/wallet", permanent: false },
      { source: "/app/terminal", destination: "/app/markets", permanent: false },
      { source: "/app/terminal/:path*", destination: "/app/markets", permanent: false },
      // Legacy ?tab= query params on /app
      { source: "/app", has: [{ type: "query", key: "tab", value: "chat" }], destination: "/app/chat", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "command" }], destination: "/app/chat", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "assets" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "markets" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "news" }], destination: "/app/chat", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "signals" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "investing" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "engine" }], destination: "/app/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "home" }], destination: "/app/wallet", permanent: false },
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
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/**"],
  },
};

module.exports = nextConfig;

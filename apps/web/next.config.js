/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy /app → /chat
      { source: "/app/chat", destination: "/chat/new", permanent: false },
      { source: "/app/chat/:conversationId", destination: "/chat/:conversationId", permanent: false },
      { source: "/app/investing", destination: "/chat/markets", permanent: false },
      { source: "/app/signals", destination: "/chat/markets", permanent: false },
      { source: "/app/assets", destination: "/chat/markets", permanent: false },
      { source: "/app/news", destination: "/chat/new", permanent: false },
      { source: "/app/personal", destination: "/chat/wallet", permanent: false },
      { source: "/app/portfolio", destination: "/chat/wallet", permanent: false },
      { source: "/app/home", destination: "/chat/wallet", permanent: false },
      { source: "/app/terminal", destination: "/chat/markets", permanent: false },
      { source: "/app/terminal/:path*", destination: "/chat/markets", permanent: false },
      { source: "/app/markets", destination: "/chat/markets", permanent: false },
      { source: "/app/wallet", destination: "/chat/wallet", permanent: false },
      { source: "/app/setup", destination: "/chat/setup", permanent: false },
      { source: "/app/setup/:path*", destination: "/chat/setup/:path*", permanent: false },
      { source: "/app", destination: "/chat/markets", permanent: false },
      { source: "/app/:path*", destination: "/chat/:path*", permanent: false },
      // Legacy ?tab= query params on /app
      { source: "/app", has: [{ type: "query", key: "tab", value: "chat" }], destination: "/chat/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "command" }], destination: "/chat/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "assets" }], destination: "/chat/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "markets" }], destination: "/chat/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "news" }], destination: "/chat/new", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "signals" }], destination: "/chat/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "investing" }], destination: "/chat/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "engine" }], destination: "/chat/markets", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "home" }], destination: "/chat/wallet", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "personal" }], destination: "/chat/wallet", permanent: false },
      { source: "/app", has: [{ type: "query", key: "tab", value: "portfolio" }], destination: "/chat/wallet", permanent: false },
      // Aliases under /chat
      { source: "/chat/investing", destination: "/chat/markets", permanent: false },
      { source: "/chat/signals", destination: "/chat/markets", permanent: false },
      { source: "/chat/assets", destination: "/chat/markets", permanent: false },
      { source: "/chat/news", destination: "/chat/new", permanent: false },
      { source: "/chat/personal", destination: "/chat/wallet", permanent: false },
      { source: "/chat/portfolio", destination: "/chat/wallet", permanent: false },
      { source: "/chat/home", destination: "/chat/wallet", permanent: false },
      { source: "/chat/terminal", destination: "/chat/markets", permanent: false },
      { source: "/chat/terminal/:path*", destination: "/chat/markets", permanent: false },
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

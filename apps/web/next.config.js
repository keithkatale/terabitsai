/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
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

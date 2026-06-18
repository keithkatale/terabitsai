/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  transpilePackages: [
    "@quant/contracts",
    "@quant/indicators",
    "@quant/mcp-server",
    "@quant/rag-engine",
  ],
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@quant/contracts",
    "@quant/indicators",
    "@quant/mcp-server",
    "@quant/rag-engine"
  ],
};

module.exports = nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  serverExternalPackages: ['node:sqlite', 'sqlite3', '@prisma/client'],
};

export default nextConfig;

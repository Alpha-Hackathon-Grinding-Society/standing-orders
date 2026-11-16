import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app is self-contained in web/; without this Next may pick up a lockfile further up the disk.
  turbopack: { root: process.cwd() },
  // The phone signs from MetaMask's browser on the local network during testnet runs.
  allowedDevOrigins: ["192.168.0.173"],
};

export default nextConfig;

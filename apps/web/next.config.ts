import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: "80mb"
    }
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }

    return [
      {
        source: "/api/rfqs/:path*",
        destination: "http://localhost:4000/api/rfqs/:path*"
      },
      {
        source: "/api/users/:path*",
        destination: "http://localhost:4000/api/users/:path*"
      }
    ];
  }
};

export default nextConfig;

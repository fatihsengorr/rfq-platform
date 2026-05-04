import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// Wrap with Sentry/GlitchTip — only enabled when SENTRY_DSN is set, so
// local dev / tests still work without a DSN. Source-map upload is
// implicitly skipped because we don't set SENTRY_AUTH_TOKEN (GlitchTip
// works fine without uploaded maps).
export default withSentryConfig(nextConfig, {
  silent: true,
});

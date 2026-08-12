import type { NextConfig } from "next";

const API_UPSTREAM = process.env.API_UPSTREAM ?? "http://127.0.0.1:47080";

const nextConfig: NextConfig = {
  // Same-origin: browser hanya bicara ke :47300; /api/* diproksi ke backend
  // (server-to-server) sehingga tak ada isu lintas-origin/cookie/jangkauan port.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_UPSTREAM}/:path*` }];
  },
};

export default nextConfig;

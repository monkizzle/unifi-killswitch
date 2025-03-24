/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    UNIFI_CONTROLLER_URL: process.env.UNIFI_CONTROLLER_URL,
    UNIFI_API_KEY: process.env.UNIFI_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "replicate.com",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [
      "placehold.co",
      "replicate.com",
      "replicate.delivery",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.openai.com/:path*",
      },
    ];
  },
  // Disable static optimization for pages that use dynamic data
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

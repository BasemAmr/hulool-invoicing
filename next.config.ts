import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/primitives",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/font",
    "@react-pdf/stylesheet",
    "@react-pdf/fns",
    "@react-pdf/render",
    "@react-pdf/types",
    "@react-pdf/image",
    "@react-pdf/textkit",
    "@react-pdf/yoga",
    "@react-pdf/reconciler",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },

};

export default nextConfig;

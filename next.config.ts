import type { NextConfig } from "next";

// Content-Security-Policy notes:
//  - 'unsafe-inline' script-src: required by Next.js bootstrap inline scripts
//    (nonce-based CSP needs per-request rendering via proxy.ts — out of scope).
//  - 'unsafe-eval' is DEV ONLY: React Refresh/HMR evals; production does not
//    (pdfjs runs with isEvalSupported: false).
//  - cdn.jsdelivr.net + blob: + 'wasm-unsafe-eval': tesseract.js loads its OCR
//    worker, wasm core, and traineddata from jsdelivr at runtime. Tighten by
//    self-hosting those assets, then drop jsdelivr from script/connect-src.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next"

const dev = process.env.NODE_ENV === "development"
const api = process.env.NEXT_PUBLIC_API_URL ? ` ${new URL(process.env.NEXT_PUBLIC_API_URL).origin}` : ""
// Static CSP: no per-request cost, and every page stays prerendered. Inline scripts are allowed for the theme
// boot script and Next's inline flight data; React escapes all rendered text and no page renders raw HTML.
// ponytail: move to a per-request nonce in proxy.ts (bundled docs: 01-app/02-guides/content-security-policy.md)
// if the app ever renders user-supplied HTML. Nonces force dynamic rendering.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${api}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }]
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL ?? "http://localhost:8434"}/api/:path*` }]
  },
}

export default config

/**
 * Next.js configuration.
 *
 * `@connected/ui` still ships TypeScript source, so Next transpiles it like first-party code.
 * `@connected/types` is compiled to `dist/` by turbo before this builds, so it needs no special
 * handling — and must not, since `apps/api` runs that same output directly on node.
 */

/**
 * Security headers that are the same on every response.
 *
 * The `Content-Security-Policy` is **not** here: it carries a per-response nonce, so it is built in
 * `middleware.ts` from `lib/security-headers.ts`, where the reasoning for each directive is
 * written down. These live here instead so they also reach the responses middleware never runs
 * for — static chunks, the favicon.
 *
 * Added after `.docs/Security/05-review-2026-08-05.md` found the app sending none of them.
 */
const securityHeaders = [
  // Duplicates the policy's `frame-ancestors 'none'` for browsers that predate it. Both say the
  // same thing: nothing may put this app in a frame, because a click in the school portal approves
  // a member or withdraws a notice, and it has to be a click the person meant.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A referrer is the page somebody was on when they clicked away, and on this product a path can
  // name a school, a class, or a report. Cross-origin destinations get the origin and no path.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here asks for any of these, and a page that never asks should not be able to.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Keeps any window this app opens, and any window that opened it, out of reach of each other.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits `.next/standalone`: the server plus only the `node_modules` it actually reached for. It
  // is what the container image runs, and in a pnpm workspace it is the difference between
  // shipping the app and shipping the monorepo. `next start` still works from `.next` as before,
  // so the E2E suite is unaffected.
  output: 'standalone',
  // Without this, standalone traces from `apps/web` and misses the workspace's hoisted
  // `node_modules` one directory up.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@connected/ui'],
  // The browser must never see a stack trace or an internal header.
  poweredByHeader: false,

  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;

/**
 * Next.js configuration.
 *
 * `@connected/ui` still ships TypeScript source, so Next transpiles it like first-party code.
 * `@connected/types` is compiled to `dist/` by turbo before this builds, so it needs no special
 * handling — and must not, since `apps/api` runs that same output directly on node.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@connected/ui'],
  // The browser must never see a stack trace or an internal header.
  poweredByHeader: false,
};

export default nextConfig;

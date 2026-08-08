# The web app.
#
# Next's `output: 'standalone'` does the work that would otherwise be a second `pnpm deploy`: it
# traces what the server actually imports and copies only that. In a pnpm workspace the difference
# is large, because the alternative is shipping a `node_modules` shared with the API, the worker,
# Playwright and the Prisma CLI.
#
# **The image is not pinned to an API.** `lib/api-client.ts` reads `API_URL` at runtime, falling
# back to the build-time `NEXT_PUBLIC_API_URL`. That ordering exists because of this file: a
# `NEXT_PUBLIC_*` value is inlined into the bundle, so an image built with one would be specific to
# the API it was built against, and staging and production would need different images of identical
# code. Set `API_URL` when running the container.

# ---------------------------------------------------------------------------------------------
FROM node:20-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---------------------------------------------------------------------------------------------
FROM base AS build

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# `@connected/types` is compiled output that Next consumes as a package; `@connected/ui` ships
# source and is transpiled by Next itself, so only the first needs building here.
RUN pnpm --filter @connected/types build \
 && pnpm --filter @connected/web build

# ---------------------------------------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production
# Bind on every interface: in a container "localhost" is the container, and nothing outside could
# reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Overridden per environment. The default is what a developer running the image alone would want.
ENV API_URL=http://localhost:4000/api/v1
WORKDIR /app

# Two copies, and the split is Next's, not ours: the traced server, then the static assets, which
# standalone deliberately omits because a CDN usually serves them. There is no `public/` in this
# app — every image it has is remote or inline, which the content security policy already required.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

# Standalone keeps the workspace's shape, so the server sits where the app did.
CMD ["node", "apps/web/server.js"]

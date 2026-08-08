# The API **and** the worker, in one image.
#
# The sprint plan said three images. This is two, and the reason is S7-17: `worker.ts` and
# `index.ts` had drifted — the worker built its notifications module without the audience parameter,
# which type-checked, and every class fan-out in the split deployment reached nobody. Two images
# built from one source is one more chance for exactly that. One artefact, two commands, and the
# thing that runs in production is byte-for-byte the thing that was tested.
#
# `-slim` rather than `-alpine`: argon2 publishes prebuilds for glibc and none for musl, so alpine
# would compile it from source in every build for a smaller base we do not need.

# ---------------------------------------------------------------------------------------------
FROM node:20-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Pinned to the version in the root package.json's `packageManager`. A different pnpm resolves the
# lockfile differently, which is the whole point of committing one.
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---------------------------------------------------------------------------------------------
FROM base AS build

# argon2 is a native module and publishes no prebuild for every platform this gets built on — on
# arm64 it falls back to node-gyp, which needs a compiler. Only the build stage gets one; the
# runtime stage receives the compiled `.node` and never sees a toolchain. Both stages share a base,
# so the binary matches the libc it will run against.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# The manifests and the lockfile first, so a source-only change reuses the install layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/

# `--ignore-scripts`, because the API's postinstall is `prisma generate` and the schema is not here
# yet. Generating happens below, explicitly, where it can be seen.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm --filter @connected/api exec prisma generate \
 && pnpm --filter @connected/types build \
 && pnpm --filter @connected/api build

# `pnpm deploy` resolves the workspace links into a real node_modules and drops every dev
# dependency — which is what keeps tsx, vitest, playwright and the Prisma CLI out of the image
# that runs in production.
RUN pnpm --filter @connected/api deploy --prod /out \
 && cp -r apps/api/dist /out/dist

# ---------------------------------------------------------------------------------------------
# The migration runner, as its own target.
#
# It exists because the runtime image deliberately cannot migrate: `pnpm deploy --prod` drops the
# Prisma CLI, and a schema sitting in an image with nothing able to apply it is worse than no schema
# at all — it reads as a capability. Migrations are a gated step in the release (S9-4) run by a
# thing that does only that, next to the database, and then exits.
FROM base AS migrate

ENV NODE_ENV=production
WORKDIR /app

# The whole built workspace, dev dependencies included, because `prisma` *is* a dev dependency.
# This image never serves traffic; it runs once and stops.
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/api

# pnpm is needed here — it is how `prisma` is invoked — but npm is not, and it is where the CVEs
# the runtime image was failing on actually live.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------------------------
# **Not `FROM base`.** The runtime carries no package manager: `base` adds corepack and pnpm, and
# the image also inherits the npm that ships inside `node:20-slim`. The first CI scan failed on
# exactly that — two fixable HIGH CVEs in npm's bundled `tar`, in an image whose only command is
# `node dist/…`. Nothing here installs anything, so a package manager is attack surface with no
# corresponding use, and stripping it is both the fix and the right shape.
FROM node:20-slim AS runtime

# Two things, and both are about what the scanner will find.
#
# The base image's package set is patched on Debian's schedule and rebuilt on the node image's,
# and those do not line up — the first scan of this file found fixable CRITICALs in `libgnutls30`
# that had been fixed upstream and not yet rebuilt here. Applying them at build is what makes
# "minimal base, scanned" mean something after the day it was written.
#
# Then the package managers. Nothing here installs anything: npm, npx and corepack are attack
# surface with no corresponding use, and npm's bundled `tar` is where this scan first failed.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production
WORKDIR /app

# `node` exists in the base image as uid 1000. Running as root would let a container escape start
# from a privileged process, and nothing here needs it.
COPY --from=build --chown=node:node /out ./

USER node

# Documentation, not a binding: the port comes from API_PORT at runtime.
EXPOSE 4000

# The API. The worker runs the same image with `node dist/worker.js`, which is the arrangement
# every test has used since S7-17 and the one ADR-0019 assumes.
CMD ["node", "dist/index.js"]

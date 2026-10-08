# syntax=docker/dockerfile:1

# MULTI-STAGE BUILD: several temporary images, only the last one is shipped.
# Build tools (TypeScript, dev dependencies, source code) never reach production.

ARG NODE_IMAGE=node:24-alpine

# ---- Stage 1: install ALL dependencies (needed to compile TypeScript) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# Copy ONLY the package files first. Docker caches each step: as long as these two files
# don't change, the slow `npm ci` is skipped on the next build, even if src/ changed.
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: compile TypeScript -> dist/ ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Stage 3: production dependencies only (no typescript, vitest, eslint...) ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 4: the final, shipped image ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Don't run as root: if the app is ever compromised, the attacker isn't root in the container.
USER node

EXPOSE 4000

# Docker checks this periodically and marks the container "unhealthy" if it fails.
# Uses the LIVENESS endpoint (no DB check) for the reasons from Phase 5.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form (JSON array): node runs as PID 1 and receives SIGTERM directly, so our
# graceful shutdown works. `npm start` would sit in between and swallow the signal.
CMD ["node", "dist/server.js"]

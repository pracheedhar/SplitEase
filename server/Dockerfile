# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files (needed for npm workspaces)
COPY package*.json ./
COPY server/package*.json ./server/

RUN npm ci --workspace=server --ignore-scripts

COPY server/tsconfig.json ./server/
COPY server/src ./server/src

RUN npm run build -w server

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S splitease && adduser -S splitease -G splitease

WORKDIR /app

# Copy built artifacts and package files from builder
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/dist ./dist

# Install only production deps (no lock file in isolated stage — use npm install)
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Environment
ENV NODE_ENV=production
ENV PORT=5001

USER splitease

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

CMD ["node", "dist/index.js"]

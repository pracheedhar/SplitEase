# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# Self-contained build context (assumes Docker is run from the server/ directory)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only server package files
COPY package.json ./

# Install development + production dependencies to compile TypeScript
RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S splitease && adduser -S splitease -G splitease

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist

# Install only production dependencies
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Environment
ENV NODE_ENV=production
ENV PORT=5001

USER splitease

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

CMD ["node", "dist/index.js"]

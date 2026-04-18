# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PAYLOAD_MIGRATIONS_DIR=dist/migrations
# Non-root execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/dist ./dist
# Remove TypeScript declaration files from migrations — Payload's readMigrationFiles
# filter matches *.ts which would include *.d.ts, causing "up is not a function" errors.
RUN find dist/migrations -name "*.d.ts" -o -name "*.d.ts.map" -o -name "*.js.map" | xargs rm -f 2>/dev/null || true
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
USER appuser

EXPOSE 4094
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD nc -z localhost 4094 || exit 1

ENTRYPOINT ["./entrypoint.sh"]

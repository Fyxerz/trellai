# ─── Stage 1: Dependencies ───────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js standalone output for smaller production image
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: Runner ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install git (needed for worktree operations)
RUN apk add --no-cache git bash

# Create non-root user
RUN addgroup --system --gid 1001 trellai && \
    adduser --system --uid 1001 trellai

# Copy standalone Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy orchestrator server (Socket.IO sidecar)
COPY --from=builder /app/orchestrator ./orchestrator
COPY --from=builder /app/node_modules ./node_modules

# Copy the entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R trellai:trellai /app/data

# Create workspace directory for auto-cloned repos
RUN mkdir -p /home/trellai/.trellai/workspaces && \
    chown -R trellai:trellai /home/trellai

USER trellai

EXPOSE 3000 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]

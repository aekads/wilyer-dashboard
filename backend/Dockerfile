# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

# Copy deps and source
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create logs dir
RUN mkdir -p logs

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S aekads -u 1001
RUN chown -R aekads:nodejs /app
USER aekads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]

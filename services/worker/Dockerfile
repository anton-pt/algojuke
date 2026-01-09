# Stage 1: Build Dependencies (includes devDependencies for TypeScript compilation)
FROM node:20-alpine AS build-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/worker/package.json ./services/worker/
RUN npm ci --workspace=@algojuke/worker --include=dev

# Stage 2: Production Dependencies (runtime only)
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/worker/package.json ./services/worker/
RUN npm ci --workspace=@algojuke/worker --omit=dev

# Stage 3: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=build-deps /app/node_modules ./node_modules
COPY services/worker/ ./
RUN npm run build

# Stage 4: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy production dependencies only
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodeuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]

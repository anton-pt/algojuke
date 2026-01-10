# Stage 1: Build Dependencies (all workspace deps for TypeScript compilation)
FROM node:24-alpine AS build-deps
WORKDIR /app
COPY package.json ./
COPY services/worker/package.json ./services/worker/
# npm ci requires full workspace structure matching lockfile; use npm install instead
RUN npm install

# Stage 2: Production Dependencies (runtime only)
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
COPY services/worker/package.json ./services/worker/
RUN npm install --omit=dev

# Stage 3: Builder
FROM node:24-alpine AS builder
WORKDIR /app/services/worker
# Copy node_modules maintaining workspace structure
COPY --from=build-deps /app/node_modules /app/node_modules
COPY services/worker/ ./
RUN npm run build

# Stage 4: Runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy production dependencies (hoisted to root)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/services/worker/dist ./dist
COPY --from=builder /app/services/worker/package.json ./

USER nodeuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]

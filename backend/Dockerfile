# Stage 1: Backend Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci

# Stage 2: Frontend Dependencies
FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

# Stage 3: Frontend Builder
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Build-time environment variables for Vite
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_TIDAL_CLIENT_ID
ARG VITE_TIDAL_REDIRECT_URI

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_TIDAL_CLIENT_ID=$VITE_TIDAL_CLIENT_ID
ENV VITE_TIDAL_REDIRECT_URI=$VITE_TIDAL_REDIRECT_URI

COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# Stage 4: Backend Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
RUN npm run build
# Copy GraphQL schemas to dist (not compiled by tsc)
RUN cp -r src/schema dist/schema

# Stage 5: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy frontend build
COPY --from=frontend-builder /app/dist ./public

USER nodeuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]

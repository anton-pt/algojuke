# Stage 1: Build Dependencies (all deps for TypeScript compilation)
FROM node:24-alpine AS build-deps
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install

# Stage 2: Frontend Dependencies
FROM node:24-alpine AS frontend-deps
WORKDIR /app
COPY package.json ./
COPY frontend/package.json ./frontend/
RUN npm install

# Stage 3: Production Dependencies (runtime only)
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
COPY backend/package.json ./backend/
RUN npm install --omit=dev

# Stage 4: Frontend Builder
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend

# Build-time environment variables for Vite (embedded at build time)
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_TIDAL_CLIENT_ID
ARG VITE_TIDAL_REDIRECT_URI

ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_TIDAL_CLIENT_ID=$VITE_TIDAL_CLIENT_ID
ENV VITE_TIDAL_REDIRECT_URI=$VITE_TIDAL_REDIRECT_URI

# Copy node_modules maintaining workspace structure
COPY --from=frontend-deps /app/node_modules /app/node_modules
COPY frontend/ ./
RUN npm run build

# Stage 5: Backend Builder
FROM node:24-alpine AS builder
WORKDIR /app/backend
# Copy node_modules maintaining workspace structure
COPY --from=build-deps /app/node_modules /app/node_modules
COPY backend/ ./
# Copy GraphQL schemas to dist (not compiled by tsc)
RUN npm run build && cp -r src/schema dist/schema

# Stage 6: Runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy backend (production deps hoisted to root)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

USER nodeuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]

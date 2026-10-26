# Multi-stage production Dockerfile for PrintPass
FROM node:20-slim AS builder

WORKDIR /app

# Copy root and package manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY agent/package*.json ./agent/

# Install dependencies
RUN npm --prefix client install
RUN npm --prefix server install --omit=dev

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client React application
RUN npm --prefix client run build

# Production runtime image
FROM node:20-slim AS runner

# Install LibreOffice headless, fonts, and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-impress \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

# Copy server and built client
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY package*.json ./

EXPOSE 5000

# Start PrintPass Express server (which serves API and client/dist with SPA fallback)
CMD ["node", "server/src/server.js"]

FROM node:18-bullseye AS builder
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json tsconfig.json ./

# Install build dependencies and node modules
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci

# Copy source code and build
COPY src ./src
COPY .env .env 
RUN npm run build

FROM node:18-bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env .env

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "dist/server.js"]
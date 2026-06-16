# Base image
FROM node:20-slim AS builder

# Create app directory
WORKDIR /app

# Install build dependencies for native modules (if any)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build/pruning if needed, or just install production)
RUN npm ci --only=production

# Copy source code
COPY . .

# Production runner stage
FROM node:20-slim

WORKDIR /app

# Copy built node_modules and code from builder stage
COPY --from=builder /app /app

# Set environments
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Run the app
CMD ["npm", "start"]

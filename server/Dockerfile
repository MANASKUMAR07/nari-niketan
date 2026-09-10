# Use official Node.js slim image (LTS)
FROM node:20-slim

# Create and use app directory
WORKDIR /app

# Copy dependency manifests first (layer cache optimisation)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

# Cloud Run sets PORT env variable; default to 8080
ENV PORT=8080
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Run as non-root for security
USER node

# Start the server
CMD ["node", "src/app.js"]

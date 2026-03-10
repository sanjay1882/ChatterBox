FROM node:20-slim

WORKDIR /app

# Switch to non-root 'node' user for security
ENV NODE_ENV=production

# Install dependencies first for caching layers
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

# Copy application code with appropriate ownership
COPY --chown=node:node . .

USER node

# Expose standard port
EXPOSE 3000

# Cloud run uses PORT env variable, defaulting to 3000
CMD ["npm", "start"]

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Only copy what we need for the worker service
COPY --chown=node:node package*.json ./
RUN npm install --omit=dev

COPY --chown=node:node . .

USER node

# Worker has no inbound port to expose 
# It connects out to Redis & APIs
CMD ["node", "index.js"]

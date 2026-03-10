# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Pass VITE backend URLs natively to build so the UI knows where the Gateway is
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# Serve stage (Nginx)
FROM nginx:alpine

# Copy built code to Nginx generic public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default nginx config with single line that enables React Router fallback (if needed)
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

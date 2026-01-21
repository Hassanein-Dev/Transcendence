# Build static frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
# COPY PUBLIC FILES
COPY public ./public
RUN npm run build && mkdir -p dist && cp -r src/index.html public/ dist/

FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
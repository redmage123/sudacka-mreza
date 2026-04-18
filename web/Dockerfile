# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts --legacy-peer-deps

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# VITE_CMS_URL is baked into the static bundle at build time
ARG VITE_CMS_URL=http://localhost:4094
ENV VITE_CMS_URL=${VITE_CMS_URL}
RUN npm run build
# Remove source maps from the production build
RUN find dist -name "*.map" -delete

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

# Fix permissions for nginx non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /run/nginx.pid && \
    chown -R nginx:nginx /run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

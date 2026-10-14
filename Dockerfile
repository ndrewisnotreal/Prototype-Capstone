# syntax=docker/dockerfile:1
# Image produksi (T-7.4, ADR-0008). Dipakai docker-compose.prod.yml; target:
#   build  : semua dependency + hasil build, juga menjalankan `prisma migrate deploy` dan seed
#   api    : Node API saja (dependency produksi)
#   web    : Caddy yang menyajikan apps/web/dist dan meneruskan /api ke API (satu origin, ADR-0003)

FROM node:22-bookworm-slim AS base
# Prisma engine butuh OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
RUN npm ci
RUN npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web

FROM base AS api
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# shared ikut utuh: npm tetap menjalankan `prepare` (build) milik workspace walau --ignore-scripts
COPY --from=build /app/packages/shared packages/shared
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/apps/api/dist apps/api/dist
# Folder unggahan (foto produk + bukti transfer) di volume, milik user non-root
RUN mkdir -p /data/uploads && chown node:node /data/uploads
ENV UPLOAD_DIR=/data/uploads PORT=3000
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM caddy:2.10-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv

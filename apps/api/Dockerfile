# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace apps/api --include-workspace-root=false

COPY apps/api apps/api
RUN npm run build --workspace apps/api

# ---------- production dependencies ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace apps/api --include-workspace-root=false --omit=dev && npm cache clean --force

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app/apps/api
ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --chown=node:node apps/api/prisma ./prisma
COPY --chown=node:node apps/api/package.json ./

USER node
EXPOSE 3000

# Migration'lar uygulanır, ardından API başlar. DB boşsa demo verileri SeedService yükler.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

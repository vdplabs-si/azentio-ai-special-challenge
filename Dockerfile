# Optional container build (Voroa's native Node runtime works without it).
# Secrets are provided at runtime as environment variables — never as build args.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app /app ./
USER app
# Voroa (and most platforms) inject PORT; next start honours it.
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:sync-catalogue && npm run start"]

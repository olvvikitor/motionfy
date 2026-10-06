# syntax=docker/dockerfile:1

# ---- deps: todas as dependências (inclui dev, para compilar) ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: gera o Prisma Client, compila e tira as dependências de dev ----
FROM deps AS build
COPY . .
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

# ---- migrate: aplica as migrations (usa o prisma CLI do estágio de deps) ----
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runtime: só o necessário para rodar ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
RUN apk add --no-cache openssl \
 && mkdir -p uploads/faces \
 && chown -R node:node /app
COPY --chown=node:node --from=build /app/package.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
USER node
EXPOSE 3000
CMD ["node", "dist/src/main"]

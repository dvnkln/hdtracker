# ---- Stage 1: install dependencies and build the app ----
FROM node:24-alpine AS build
WORKDIR /app

# Build tools, only used if no prebuilt better-sqlite3 binary is available
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Stage 2: small runtime image ----
FROM node:24-alpine
WORKDIR /app

# tzdata makes the TZ variable work
RUN apk add --no-cache tzdata && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle

USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "build"]

# The image is built for several processor types (amd64, arm64). Building the app itself gives
# the same result on all of them, so it is done only once, on the machine's own processor type –
# never emulated, which is slow and has crashed before. Only the small set of runtime packages
# is installed per processor type (better-sqlite3 brings a ready-made binary for each).

# ---- Stage 1: build the app (once, on the build machine's own processor type) ----
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app

# Build tools, only used if no prebuilt better-sqlite3 binary is available
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: runtime packages for the processor type of the image ----
FROM node:24-alpine AS deps
WORKDIR /app

# Build tools, only used if no prebuilt better-sqlite3 binary is available
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# ---- Stage 3: small runtime image ----
FROM node:24-alpine
WORKDIR /app

# tzdata makes the TZ variable work
RUN apk add --no-cache tzdata && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle

COPY --from=build /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/start.js ./start.js
# Rescue tool: docker exec hdtracker node reset-password.js
COPY --from=build /app/reset-password.js ./reset-password.js

USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "start.js"]

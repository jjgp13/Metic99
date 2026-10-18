# The Metic99 game server + the built game, in one container (docs/NETCODE.md, S6).
# Works on any host that runs containers: Fly.io, Render, Railway, a VM.
# The host's HTTPS proxy turns ws:// into wss:// (TLS), so the page and the
# socket share one secure address.

# 1. Build the game (dist/) and the server (dist-server/main.js).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# No .git in the image: client and server both get build id "unknown",
# which still matches (they come from the same build).
RUN npm run build && npm run build:server

# 2. Run it with only the runtime dependency (ws).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8787
HEALTHCHECK CMD wget -qO- http://localhost:8787/health || exit 1
CMD ["node", "dist-server/main.js"]

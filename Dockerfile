# ---------------------------------------------------------------------------
# Devma Cake n' Party — single app image (Express API + built React storefront)
# ---------------------------------------------------------------------------

# 1) Build the storefront
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY client client
RUN npm run build

# 2) Runtime: server + production dependencies only
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    SERVE_CLIENT=true
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace=server --no-audit --no-fund && npm cache clean --force
COPY server server
COPY --from=build /app/client/dist client/dist
# The seed script (re)writes demo artwork here; the built copy is served from client/dist.
COPY client/public/seed-images client/public/seed-images
RUN mkdir -p server/uploads && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/docker/entrypoint.js"]

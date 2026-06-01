FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    TRANSPORT=http \
    PORT=3000
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/index.js"]

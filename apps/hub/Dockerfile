FROM node:22-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/hub/package.json apps/hub/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/app-sdk/package.json packages/app-sdk/package.json
COPY packages/motion/package.json packages/motion/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter @guildora/hub build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3003
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/hub/.output ./.output
COPY --from=build /repo/packages/shared/drizzle/migrations ./.output/migrations
RUN mkdir -p /app/.output/public/uploads/avatars && chown -R app:app /app/.output/public/uploads
USER app
EXPOSE 3003
CMD ["node", "--max-old-space-size=1024", ".output/server/index.mjs"]

FROM node:22-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/app-sdk/package.json packages/app-sdk/package.json
COPY packages/motion/package.json packages/motion/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter @guildora/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/web/.output ./.output
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

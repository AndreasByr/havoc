FROM node:22-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/cms/package.json apps/cms/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p apps/cms/public apps/cms/media && pnpm --filter @guildora/cms build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app && mkdir -p public media
COPY --from=build /repo/apps/cms/.next/standalone ./
COPY --from=build /repo/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=build /repo/apps/cms/public ./apps/cms/public
COPY --from=build /repo/apps/cms/media ./apps/cms/media
USER app
EXPOSE 3001
CMD ["node", "apps/cms/server.js"]

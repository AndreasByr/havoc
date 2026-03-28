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
RUN pnpm --filter @guildora/cms build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/cms/.next/standalone ./
COPY --from=build /repo/apps/cms/.next/static ./.next/static
COPY --from=build /repo/apps/cms/public ./public
COPY --from=build /repo/apps/cms/media ./media
USER app
EXPOSE 3001
CMD ["node", "server.js"]

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 43123
CMD ["pnpm", "dev"]

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV AUTH_SECRET=build-only-secret-not-used-at-runtime
ENV AUTH_URL=http://localhost:43123
ENV DATABASE_URL=postgres://facilityiq:facilityiq@127.0.0.1:5432/facilityiq
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43123
ENV HOSTNAME=0.0.0.0
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 43123
CMD ["node", "server.js"]

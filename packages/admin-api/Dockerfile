FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/admin-api/package.json packages/admin-api/

RUN pnpm install --no-frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/admin-api/ packages/admin-api/

RUN pnpm --filter @ctc/shared build && pnpm --filter @ctc/admin-api build

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=base /app ./

EXPOSE 4001
CMD ["node", "packages/admin-api/dist/index.js"]

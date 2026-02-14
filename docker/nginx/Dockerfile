FROM node:20-alpine AS web-build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

RUN pnpm install --no-frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/

RUN pnpm --filter @ctc/shared build && pnpm --filter @ctc/web build

FROM node:20-alpine AS admin-build
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/admin-web/package.json packages/admin-web/

RUN pnpm install --no-frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/admin-web/ packages/admin-web/

RUN pnpm --filter @ctc/shared build 2>/dev/null; pnpm --filter @ctc/admin-web build

FROM nginx:alpine

COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/admin.conf /etc/nginx/conf.d/admin.conf

COPY --from=web-build /app/packages/web/dist /usr/share/nginx/html
COPY --from=admin-build /app/packages/admin-web/dist /usr/share/nginx/admin

EXPOSE 3000 3001

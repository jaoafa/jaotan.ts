FROM node:24-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
# pnpm v11 では TTY なし環境での node_modules 削除確認を回避するために CI=true が必要
ENV CI=true

# hadolint ignore=DL3018
RUN apk update && \
  apk upgrade && \
  apk add --update --no-cache tzdata && \
  cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime && \
  echo "Asia/Tokyo" > /etc/timezone && \
  apk del tzdata && \
  npm install -g corepack@latest && \
  corepack enable

WORKDIR /app

COPY pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

COPY package.json tsconfig.json ./
COPY src src

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prefer-offline

COPY assets /assets

ENV NODE_ENV=production
ENV CONFIG_PATH=/data/config.json
ENV DATA_DIR=/data
ENV LOG_DIR=/data/logs
ENV ASSETS_DIR=/assets

VOLUME [ "/data" ]

ENTRYPOINT [ "pnpm", "start" ]

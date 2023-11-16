FROM node:21-alpine

SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

# hadolint ignore=DL3018
RUN apk update && \
  apk upgrade && \
  apk add --update --no-cache curl tzdata && \
  cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime && \
  echo "Asia/Tokyo" > /etc/timezone && \
  apk del tzdata && \
  curl -f https://get.pnpm.io/v6.32.js | \
  node - add --global pnpm

WORKDIR /app

COPY pnpm-lock.yaml ./

RUN pnpm fetch

COPY package.json tsconfig.json ./
COPY src src

RUN pnpm install --frozen-lockfile --offline

ENV NODE_ENV production
ENV CONFIG_PATH /data/config.json
ENV LOG_DIR /data/logs

VOLUME [ "/data" ]

ENTRYPOINT [ "pnpm", "start" ]
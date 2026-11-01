FROM node:26-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"

# hadolint ignore=DL3018
RUN apk update && \
  apk upgrade && \
  apk add --update --no-cache tzdata && \
  cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime && \
  echo "Asia/Tokyo" > /etc/timezone && \
  apk del tzdata && \
  npm install -g corepack@latest && \
  corepack enable

# renovate: datasource=github-releases depName=WorksApplications/SudachiDict versioning=loose
ENV SUDACHI_DICT_VERSION=v20261015

# sudachi-wasm333 は sudachi.rs 0.6 系の旧形式の辞書だけを読める。v1/ 配下や GitHub のリリースの辞書は読めない。
RUN wget -q -O /tmp/sudachi-dict.zip "https://d2ej7fkh96fzlu.cloudfront.net/sudachidict/sudachi-dictionary-${SUDACHI_DICT_VERSION#v}-core.zip" && \
  mkdir -p /opt/sudachi && \
  unzip -q -j /tmp/sudachi-dict.zip "*/system_core.dic" -d /opt/sudachi && \
  rm /tmp/sudachi-dict.zip && \
  test -s /opt/sudachi/system_core.dic

ENV SUDACHI_DICT_PATH=/opt/sudachi/system_core.dic

WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# sudachi-wasm333 が同梱する辞書は使わないため、層に残らないよう同じ RUN で消す。
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
  pnpm fetch && \
  pnpm install --frozen-lockfile --offline && \
  rm -rf node_modules/.pnpm/sudachi-wasm333@*/node_modules/sudachi-wasm333/resources

COPY tsconfig.json ./
COPY src src

RUN node --input-type=module -e "import fs from 'node:fs'; import { SudachiStateless } from 'sudachi-wasm333'; try { await new SudachiStateless().initialize_node(fs.promises.readFile, process.env.SUDACHI_DICT_PATH) } catch (error) { console.error(JSON.stringify(error)); process.exit(1) }"

COPY assets /assets

ENV NODE_ENV=production
ENV CONFIG_PATH=/data/config.json
ENV DATA_DIR=/data
ENV LOG_DIR=/data/logs
ENV ASSETS_DIR=/assets

VOLUME [ "/data" ]

ENTRYPOINT [ "pnpm", "start" ]

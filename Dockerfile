FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ARG APP_VERSION=development
ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.version=$APP_VERSION \
      io.usercue.app-version=$APP_VERSION \
      org.opencontainers.image.revision=$SOURCE_REVISION \
      org.opencontainers.image.source="https://github.com/Paddlewheel-Inc/usercue"
ENV USERCUE_REVISION=$SOURCE_REVISION
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
COPY --from=build /app .
RUN if [ "$APP_VERSION" != development ]; then bun -e 'if (require("./package.json").version !== process.argv[1]) process.exit(1)' "$APP_VERSION"; fi
RUN mkdir -p /data
EXPOSE 3000
VOLUME ["/data"]
CMD ["bun", "run", "start"]

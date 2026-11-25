FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN npm exec --yes --package=bun@1.4.5 -- bun install --frozen-lockfile
COPY . .
RUN npm run lint && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production VOS_REQUIRE_PRIVATE_ACCESS=1 DATA_DIR=/app/data
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/server ./server
COPY --from=build /app/src/data ./src/data
EXPOSE 3000
CMD ["node", "server.ts"]

# 构建
FROM node:26-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc .node-version ./
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 运行：nginx 提供静态文件，启动时按环境变量生成配置
FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-lc-config.sh /docker-entrypoint.d/40-lc-config.sh
RUN chmod +x /docker-entrypoint.d/40-lc-config.sh
EXPOSE 80

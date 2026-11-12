# 构建阶段
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段：只带产物，不带源码与 devDependencies
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.output ./.output

# 收藏与历史落在这里，需要挂卷持久化
VOLUME /app/data
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

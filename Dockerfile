# 使用官方 Node.js 运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 构建时注入前端公开 API 地址
ARG NEXT_PUBLIC_API_URL=http://localhost:13082
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --omit=dev

# 复制应用代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads public/images

# 构建应用
RUN NODE_ENV=production npx next build --webpack

# 暴露端口
EXPOSE 13080 13082

# 启动应用
CMD ["sh", "-c", "node server/index.js & npx next start --webpack -p 13080"]


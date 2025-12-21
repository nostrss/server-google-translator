FROM node:20-alpine

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 의존성 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 복사 및 빌드
COPY . .
RUN pnpm build

# Cloud Run은 PORT 환경변수 자동 주입
EXPOSE 3000

CMD ["pnpm", "start"]

FROM node:lts-slim
RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev 
WORKDIR /usr/src/app
COPY ["package.json", "pnpm-lock.yaml", "./"]
RUN corepack enable && pnpm i --frozen-lockfile && rm -rf ~/.local/share/pnpm/store
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]
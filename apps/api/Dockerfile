FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY config ./config
COPY tsconfig.json ./
RUN npm install --omit=dev --workspaces --if-present || npm install
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "apps/api/src/index.ts"]

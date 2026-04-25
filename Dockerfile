# Build stage
FROM node:24-slim AS build

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:24-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/prisma ./prisma

EXPOSE 3500

ENV NODE_ENV=production
ENV DATABASE_URL="file:./prisma/dev.db"

CMD npx prisma db push --accept-data-loss --skip-generate 2>/dev/null; node -r tsx ./server.ts
# Build stage
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the frontend assets
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install deps for production
COPY package*.json ./
RUN npm install --production && \
    npm install -g tsx prisma

# Copy build artifacts and server code
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/.env.example ./.env

EXPOSE 3000

ENV NODE_ENV=production
ENV DATABASE_URL="file:./prisma/dev.db"

# We run a small script to ensure DB is pushed before starting
CMD npx prisma db push --accept-data-loss && tsx server.ts

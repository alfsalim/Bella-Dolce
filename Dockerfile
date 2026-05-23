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

RUN mkdir -p /app/certs && \
    openssl req -x509 -newkey rsa:4096 \
      -keyout /app/certs/key.pem \
      -out /app/certs/cert.pem \
      -days 3650 -nodes \
      -subj "/CN=bella-dolce"

COPY package*.json ./
# Do not run npm install here: postinstall runs prisma generate before prisma/ is copied.
# node_modules comes from the build stage (already includes prisma generate).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/app.config.ts ./
COPY --from=build /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

# Force PRINT_LANGUAGE=FR in production Docker image
RUN sed -i "s/PRINT_LANGUAGE: \"[A-Z]*\"/PRINT_LANGUAGE: \"FR\"/g" app.config.ts && \
    grep "PRINT_LANGUAGE" app.config.ts

EXPOSE 3000

ENV NODE_ENV=production

ENTRYPOINT ["sh", "entrypoint.sh"]
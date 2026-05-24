# Bella Dolce — run locally

## Development: single app (Node + Vite, no Docker)

Day-to-day work uses **one process**: Express serves the API and **Vite in middleware mode** for the React UI (same origin, HMR for `src/`).

1. **Install**  
   `npm install`

2. **Database**  
   Set in `.env` (example):
   ```env
   DATABASE_URL="file:./dev.db"
   ```
   Then:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Start**  
   ```bash
   npm run dev
   ```

4. **Open**  
   [http://localhost:3000](http://localhost:3000)  
   (Port comes from `app.config.ts` / `PORT` in `.env` if set.)

`BELLA_HTTP_ONLY` and Docker-only settings **do not apply** here unless you set them yourself.

---

## Optional: Docker Compose

Use this when you want the app in a container instead of local Node.

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start (SQLite)

1. `.env` with at least `GEMINI_API_KEY` if you use AI features.
2. ```bash
   docker compose up --build -d
   ```
3. Open [http://localhost:3000](http://localhost:3000).

- **Default login**: `admin` / `password`

### Advanced: PostgreSQL

1. Change `prisma/schema.prisma` `provider` to `postgresql` and set `DATABASE_URL`.
2. Add a `db` service and matching `DATABASE_URL` in `docker-compose.yml`.
3. `docker compose down && docker compose up --build -d`

### Useful commands

- **Logs**: `docker compose logs -f bella-dolce2`
- **Stop**: `docker compose down`

### Docker notes

- SQLite file on the host: **`./data`** → `/app/data` in the container (`file:/app/data/dev.db`).
- **HTTP vs HTTPS**: Compose sets `BELLA_HTTP_ONLY=1` so **http://localhost:3000** works. Remove it in compose if you want TLS from the image certs.

### Environment variables

Provide secrets in `.env` or under `environment:` in `docker-compose.yml`.

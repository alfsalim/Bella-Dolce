# Local Docker Deployment Guide

To deploy the **Bella Dolce Bakery Management System** on your local machine using Docker, follow these steps.

## Prerequisites
- [Docker](https://www.docker.com/get-started) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

## Quick Start (SQLite)

The default configuration is set up to use **SQLite** for zero-config deployment.

1. **Clone the repository** (if you haven't already).
2. **Create a `.env` file** in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. **Build and start the container**:
   ```bash
   docker-compose up --build -d
   ```
4. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Default Credentials**: 
  - Username: `admin`
  - Password: `password`

## Advanced: Switching to PostgreSQL

If you prefer a production-grade database like PostgreSQL:

1. **Modify `prisma/schema.prisma`**:
   Change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. **Modify `docker-compose.yml`**:
   - Uncomment the `db` service.
   - Update the `app` service's `DATABASE_URL` to:
     `postgresql://postgres:postgres@db:5432/belladolce?schema=public`
   - Uncomment the `postgres_data` volume.
3. **Restart the containers**:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

## Useful Commands

- **View Logs**: `docker-compose logs -f app`
- **Stop App**: `docker-compose down`
- **Reset Database**: `docker-compose down -v` (removes volumes)

## Note on Environment Variables
Ensure all required variables from `.env.example` are provided in your local `.env` or in the `docker-compose.yml` environment section.

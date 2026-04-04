# Debian slim (glibc) — Prisma engine downloads for linux-musl (Alpine) often fail in Docker
# behind strict networks; glibc targets are more reliable.
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# prisma/ must exist before `npm install` (postinstall runs `prisma generate`)
COPY package.json ./
COPY prisma ./prisma
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Use db push until you add migrations (run `npx prisma migrate dev` locally, commit prisma/migrations/, then switch to `migrate deploy`).
# Seed is idempotent (upserts); ensures demo users exist on fresh volumes (see prisma/seed.ts).
CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/index.js"]

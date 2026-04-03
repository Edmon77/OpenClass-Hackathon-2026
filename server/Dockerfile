FROM node:20-alpine
WORKDIR /app
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
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]

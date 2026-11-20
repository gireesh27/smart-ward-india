# syntax=docker/dockerfile:1.7
FROM node:20.18-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20.18-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only: pages are rendered dynamically, so no database
# or secrets are needed to compile. Real values come from the runtime env.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime-000000 \
    APP_URL=http://localhost:3000
RUN npx prisma generate && npm run build

FROM node:20.18-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# LGD coverage figures shown on the home page and in Settings → Geography
COPY --from=build /app/data/lgd/andhra-pradesh/report.json ./data/lgd/andhra-pradesh/report.json
COPY --from=build /app/scripts/docker/start.sh ./start.sh
# Tolerate Windows line endings if the script was edited on Windows
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh
RUN mkdir -p /app/storage/uploads && chown -R app:app /app/storage
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Schema first (migrate deploy, or db push when the image has no migrations), then start.
# Seeding is never run in production. See scripts/docker/start.sh.
CMD ["sh", "./start.sh"]

# Admin tasks with the full toolchain and the LGD data (docs/DEPLOYMENT.md):
#   docker compose --profile tools run --rm tools npm run lgd:import
FROM build AS tools
ENV NODE_ENV=production
# The npm scripts load .env with --env-file; in containers the variables come from the environment,
# so an empty .env keeps those commands working.
RUN touch .env
CMD ["npm", "run", "lgd:import"]

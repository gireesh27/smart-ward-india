# Scaling Smart Ward India

Today: one state (Andhra Pradesh) with 245,030 wards, one Next.js app and one PostgreSQL database. This
handles a state-wide pilot comfortably on a 2 vCPU / 4–8 GB server. For all of India
(about 2.5 lakh Gram Panchayats and millions of wards), scale in this order:

1. **Database first**
   - Composite indexes that match the filters (e.g. complaints by `wardId, status, createdAt`); `pg_trgm` indexes for name search.
   - Partition `Complaint` by month (range) once it reaches tens of millions of rows; partition geography by state (list) for multi-state.
   - PgBouncer in transaction mode in front of Postgres; Prisma URL with `pgbouncer=true&connection_limit=5`, and a separate `directUrl` for `prisma migrate deploy` (migrations cannot run through PgBouncer).
   - A read replica for dashboards and exports; materialised views (refreshed every 5–15 minutes) for district and mandal roll-ups.
2. **App tier**: the container is stateless, so add replicas behind the load balancer (Azure Container Apps / ECS). Cache public dashboard data (`revalidate` / `unstable_cache`) and use Redis for rate limits and hot aggregates.
3. **Background jobs**: move notifications, insight generation, imports and media processing to a queue (pg-boss uses the same Postgres; BullMQ + Redis if throughput demands).
4. **Media**: upload straight to object storage with presigned URLs; a worker makes thumbnails (sharp) and transcodes video (ffmpeg); strip GPS EXIF from public copies.
5. **Maps**: serve the GeoJSON layers from a CDN; at national scale convert them to **PMTiles** vector tiles (tippecanoe) and render with MapLibre GL JS. No tile server is needed for PMTiles.
6. **Multi-state**: add `stateCode` to every row and Postgres row-level security; one deployment can serve many states. Run a weekly **LGD sync** that diffs by LGD code, applies renames/mergers and marks removed units inactive (never deletes).
7. **Operations**: OpenTelemetry tracing (Next.js `instrumentation.ts`), structured logs with request IDs, budgets and alerts from day one, nightly backups tested by restore, a DPDP breach-intimation runbook.
8. **Search and languages**: Telugu/Hindi with Noto Sans fonts (Telugu is already wired), Bhashini for translation, Meilisearch if typo-tolerant multilingual search is needed.

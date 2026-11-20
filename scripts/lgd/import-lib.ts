/**
 * Loads the normalised LGD CSVs (see scripts/lgd/convert.mjs) into PostgreSQL.
 * Idempotent: rows are upserted by their official LGD code with
 * INSERT … ON CONFLICT, in batches, so re-running after an LGD refresh updates
 * names and parents without touching complaints, users or projects.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import DISTRICT_HQ from "../../data/geo/district-hq.json";
import { parseCsv } from "../../src/lib/domain/csv-parse";

export { parseCsv };

export const DEFAULT_LGD_DIR = "data/lgd/andhra-pradesh";


function read(dir: string, file: string) {
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`Missing ${path}. Run "npm run lgd:convert" first (see docs/LGD_DATA.md).`);
  return parseCsv(readFileSync(path, "utf8"));
}

type Log = (msg: string) => void;
const BATCH = 1000;

async function upsertBatches<T>(prisma: PrismaClient, rows: T[], build: (chunk: T[]) => Prisma.Sql, log: Log, label: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.$executeRaw(build(rows.slice(i, i + BATCH)));
    if (rows.length > 20_000 && (i / BATCH) % 40 === 0) log(`  ${label}: ${Math.min(i + BATCH, rows.length).toLocaleString("en-IN")} / ${rows.length.toLocaleString("en-IN")}`);
  }
}
const n = (v: string) => (v === "" ? null : v);

export async function importLgd(prisma: PrismaClient, opts: { dir?: string; stateName?: string; stateCode?: string; stateLgdCode?: string; log?: Log } = {}) {
  const dir = opts.dir ?? process.env.LGD_DATA_DIR ?? DEFAULT_LGD_DIR;
  const log = opts.log ?? console.log;
  const districts = read(dir, "districts.csv");
  const subdistricts = read(dir, "subdistricts.csv");
  const localBodies = read(dir, "local-bodies.csv");
  const wards = read(dir, "wards.csv");
  const villages = read(dir, "villages.csv");
  log(`LGD data: ${districts.length} districts, ${subdistricts.length} mandals, ${localBodies.length.toLocaleString("en-IN")} local bodies, ${wards.length.toLocaleString("en-IN")} wards, ${villages.length.toLocaleString("en-IN")} villages`);

  const state = await prisma.state.upsert({
    where: { code: opts.stateCode ?? "AP" },
    create: { name: opts.stateName ?? "Andhra Pradesh", code: opts.stateCode ?? "AP", lgdCode: opts.stateLgdCode ?? "28" },
    update: { name: opts.stateName ?? "Andhra Pradesh", lgdCode: opts.stateLgdCode ?? "28" },
  });

  const hq = DISTRICT_HQ as unknown as Record<string, { lat: number; lng: number } | undefined>;
  await upsertBatches(prisma, districts, (c) => Prisma.sql`
    INSERT INTO "District" ("id","name","nameLocal","code","lgdCode","census2011","stateId","latitude","longitude") VALUES
    ${Prisma.join(c.map((d) => Prisma.sql`(${randomUUID()}, ${d.name}, ${n(d.nameLocal)}, ${d.lgdCode}, ${d.lgdCode}, ${n(d.census2011)}, ${state.id}, ${hq[d.lgdCode]?.lat ?? null}, ${hq[d.lgdCode]?.lng ?? null})`))}
    ON CONFLICT ("lgdCode") DO UPDATE SET "name" = EXCLUDED."name", "nameLocal" = EXCLUDED."nameLocal", "census2011" = EXCLUDED."census2011",
      "latitude" = COALESCE(EXCLUDED."latitude", "District"."latitude"), "longitude" = COALESCE(EXCLUDED."longitude", "District"."longitude")`, log, "districts");
  const districtId = new Map((await prisma.district.findMany({ select: { id: true, lgdCode: true } })).map((d) => [d.lgdCode, d.id]));

  await upsertBatches(prisma, subdistricts, (c) => Prisma.sql`
    INSERT INTO "SubDistrict" ("id","lgdCode","name","nameLocal","districtId") VALUES
    ${Prisma.join(c.map((s) => Prisma.sql`(${randomUUID()}, ${s.lgdCode}, ${s.name}, ${n(s.nameLocal)}, ${districtId.get(s.districtCode)!})`))}
    ON CONFLICT ("lgdCode") DO UPDATE SET "name" = EXCLUDED."name", "nameLocal" = EXCLUDED."nameLocal", "districtId" = EXCLUDED."districtId"`, log, "mandals");
  const subId = new Map((await prisma.subDistrict.findMany({ select: { id: true, lgdCode: true } })).map((s) => [s.lgdCode, s.id]));

  const lbRows = localBodies.filter((l) => districtId.has(l.districtCode));
  await upsertBatches(prisma, lbRows, (c) => Prisma.sql`
    INSERT INTO "LocalBody" ("id","name","type","lgdCode","districtId","subDistrictId","blockName","villageCount","isActive") VALUES
    ${Prisma.join(c.map((l) => Prisma.sql`(${randomUUID()}, ${l.name}, ${l.type}::"LocalBodyType", ${l.lgdCode}, ${districtId.get(l.districtCode)!}, ${subId.get(l.subDistrictCode) ?? null}, ${n(l.block)}, ${Number(l.villageCount) || 0}, true)`))}
    ON CONFLICT ("lgdCode") DO UPDATE SET "name" = EXCLUDED."name", "type" = EXCLUDED."type", "districtId" = EXCLUDED."districtId",
      "subDistrictId" = EXCLUDED."subDistrictId", "blockName" = EXCLUDED."blockName", "villageCount" = EXCLUDED."villageCount", "isActive" = true`, log, "local bodies");
  const lbId = new Map((await prisma.localBody.findMany({ where: { lgdCode: { not: null } }, select: { id: true, lgdCode: true } })).map((l) => [l.lgdCode!, l.id]));

  const wardRows = wards.filter((w) => lbId.has(w.localBodyCode));
  await upsertBatches(prisma, wardRows, (c) => Prisma.sql`
    INSERT INTO "Ward" ("id","number","name","nameLocal","lgdCode","localBodyId","isActive","createdAt") VALUES
    ${Prisma.join(c.map((w) => Prisma.sql`(${randomUUID()}, ${Number(w.number)}, ${w.name}, ${n(w.nameLocal)}, ${w.lgdCode}, ${lbId.get(w.localBodyCode)!}, true, NOW())`))}
    ON CONFLICT ("lgdCode") DO UPDATE SET "name" = EXCLUDED."name", "nameLocal" = EXCLUDED."nameLocal", "isActive" = true`, log, "wards");

  const villageRows = villages.filter((v) => districtId.has(v.districtCode));
  await upsertBatches(prisma, villageRows, (c) => Prisma.sql`
    INSERT INTO "Village" ("id","lgdCode","name","nameLocal","status","districtId","subDistrictId","localBodyId") VALUES
    ${Prisma.join(c.map((v) => Prisma.sql`(${randomUUID()}, ${v.lgdCode}, ${v.name}, ${n(v.nameLocal)}, ${n(v.status)}, ${districtId.get(v.districtCode)!}, ${subId.get(v.subDistrictCode) ?? null}, ${lbId.get(v.gpCode) ?? null})`))}
    ON CONFLICT ("lgdCode") DO UPDATE SET "name" = EXCLUDED."name", "nameLocal" = EXCLUDED."nameLocal", "status" = EXCLUDED."status",
      "districtId" = EXCLUDED."districtId", "subDistrictId" = EXCLUDED."subDistrictId", "localBodyId" = EXCLUDED."localBodyId"`, log, "villages");

  // Local bodies / wards no longer present in LGD are deactivated (never deleted: complaints may reference them).
  const liveLb = new Set(lbRows.map((l) => l.lgdCode));
  const liveWard = new Set(wardRows.map((w) => w.lgdCode));
  const staleLb = (await prisma.localBody.findMany({ where: { lgdCode: { not: null }, isActive: true }, select: { id: true, lgdCode: true } })).filter((l) => !liveLb.has(l.lgdCode!));
  const staleWard = (await prisma.ward.findMany({ where: { lgdCode: { not: null }, isActive: true }, select: { id: true, lgdCode: true } })).filter((w) => !liveWard.has(w.lgdCode!));
  for (let i = 0; i < staleLb.length; i += 5000) await prisma.localBody.updateMany({ where: { id: { in: staleLb.slice(i, i + 5000).map((l) => l.id) } }, data: { isActive: false } });
  for (let i = 0; i < staleWard.length; i += 5000) await prisma.ward.updateMany({ where: { id: { in: staleWard.slice(i, i + 5000).map((w) => w.id) } }, data: { isActive: false } });

  const summary = { stateId: state.id, districts: districtId.size, mandals: subId.size, localBodies: lbRows.length, wards: wardRows.length, villages: villageRows.length, deactivatedLocalBodies: staleLb.length, deactivatedWards: staleWard.length };
  log(`LGD import complete: ${JSON.stringify(summary)}`);
  return summary;
}

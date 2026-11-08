import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import { DEMO_PASSWORD, ORG_SLUG } from "@/db/seed/ids";
import { verifyPassword } from "@/lib/auth/password";

async function row<T>(query: ReturnType<typeof sql>) {
  const result = await getDb().execute(query);
  return result.rows[0] as T;
}

async function fingerprint() {
  const counts = await row<{
    pallets: number;
    racks: number;
    docks: number;
    stations: number;
    conveyors: number;
    forklifts: number;
    insights: number;
    scenarios: number;
    metric_sum: string;
    titles: string;
  }>(sql`
    select
      (select count(*)::int from assets where asset_type = 'pallet') as pallets,
      (select count(*)::int from assets where asset_type = 'storage_rack') as racks,
      (select count(*)::int from assets where asset_type = 'loading_dock') as docks,
      (select count(*)::int from assets where asset_type = 'packing_station') as stations,
      (select count(*)::int from assets where asset_type = 'conveyor') as conveyors,
      (select count(*)::int from assets where asset_type = 'forklift') as forklifts,
      (select count(*)::int from insights) as insights,
      (select count(*)::int from scenarios) as scenarios,
      (select sum(metric_value)::text from operational_metrics) as metric_sum,
      (select string_agg(title, '|' order by title) from insights) as titles
  `);
  const aisle = await row<{ avg: string }>(sql`
    select avg(metric_value)::text as avg
    from operational_metrics m
    join facility_areas a on a.id = m.area_id
    where a.name = 'Aisle 04' and m.metric_type = 'utilization'
  `);
  const healthy = await row<{ avg: string }>(sql`
    select avg(metric_value)::text as avg
    from operational_metrics m
    join facility_areas a on a.id = m.area_id
    where a.name = 'Aisle 01' and m.metric_type = 'utilization'
  `);
  const station = await row<{ avg: string }>(sql`
    select avg(metric_value)::text as avg
    from operational_metrics m
    join assets asset on asset.id = m.asset_id
    where asset.name = 'PS-02' and m.metric_type = 'utilization'
  `);
  const idle = await row<{ names: string }>(sql`
    select string_agg(name, ',' order by name) as names
    from (
      select asset.name
      from assets asset
      join operational_metrics m on m.asset_id = asset.id and m.metric_type = 'utilization'
      where asset.asset_type = 'forklift'
      group by asset.name
      having avg(m.metric_value) < 20
    ) idle
  `);
  const dwell = await row<{ first: string; last: string }>(sql`
    with ordered as (
      select metric_value, recorded_at,
             row_number() over (order by recorded_at) as first_row,
             row_number() over (order by recorded_at desc) as last_row
      from operational_metrics m
      join assets asset on asset.id = m.asset_id
      where asset.name = 'DK-01' and m.metric_type = 'dwell_time_minutes'
    )
    select
      max(metric_value) filter (where first_row = 1)::text as first,
      max(metric_value) filter (where last_row = 1)::text as last
    from ordered
  `);
  const maintenance = await row<{ first: string; last: string }>(sql`
    with ordered as (
      select amount, period_start,
             row_number() over (order by period_start) as first_row,
             row_number() over (order by period_start desc) as last_row
      from financial_metrics f
      join assets asset on asset.id = f.asset_id
      where asset.name = 'CV-02' and f.cost_category = 'maintenance'
    )
    select
      max(amount) filter (where first_row = 1)::text as first,
      max(amount) filter (where last_row = 1)::text as last
    from ordered
  `);
  return {
    row: counts,
    aisle: Number(aisle.avg),
    healthy: Number(healthy.avg),
    station: Number(station.avg),
    idle: idle.names,
    dwellFirst: Number(dwell.first),
    dwellLast: Number(dwell.last),
    maintenanceFirst: Number(maintenance.first),
    maintenanceLast: Number(maintenance.last),
  };
}

describe("Acme seed", () => {
  it("is repeatable and contains the five operating problems", async () => {
    await seedDatabase();
    const first = await fingerprint();
    await seedDatabase();
    const second = await fingerprint();

    expect(second).toEqual(first);
    expect(first.row?.pallets).toBe(500);
    expect(first.row?.racks).toBe(80);
    expect(first.row?.docks).toBe(6);
    expect(first.row?.stations).toBe(4);
    expect(first.row?.conveyors).toBe(3);
    expect(first.row?.forklifts).toBe(5);
    expect(Number(first.row?.insights)).toBeGreaterThanOrEqual(5);
    expect(first.row?.scenarios).toBe(3);
    expect(first.aisle).toBeGreaterThan(90);
    expect(first.healthy).toBeLessThan(80);
    expect(first.station).toBeGreaterThan(95);
    expect(first.idle).toBe("FL-04,FL-05");
    expect(first.dwellLast - first.dwellFirst).toBeGreaterThan(30);
    expect(first.maintenanceLast).toBeGreaterThan(first.maintenanceFirst * 3);

    const admin = await row<{ password_hash: string }>(sql`
      select password_hash from users where email = 'admin@acme.example'
    `);
    expect(await verifyPassword(DEMO_PASSWORD, admin.password_hash)).toBe(true);
    const org = await row<{ slug: string }>(sql`
      select slug from organizations where slug = ${ORG_SLUG}
    `);
    expect(org.slug).toBe(ORG_SLUG);
  });
});

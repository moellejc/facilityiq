import { and, asc, desc, eq, sql } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { assetEvents, assets, facilities, facilityAreas, facilityLayouts } from "@/db/schema";
import { boundsFromAreas, readBounds, toSample } from "@/lib/twin/scene";
import type {
  AssetCategory,
  FacilityScene,
  SceneArea,
  SceneAsset,
  SceneEvent,
} from "@/lib/twin/types";

type SampleRow = {
  asset_id?: string | null;
  area_id?: string | null;
  metric_value: string;
  unit: string;
  recorded_at: Date;
};

export async function loadFacilityScene(
  organizationId: string,
  userId: string,
  facilityId: string,
): Promise<FacilityScene | null> {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [facility] = await tx
      .select()
      .from(facilities)
      .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, facilityId)));
    if (!facility) return null;

    const [layout] = await tx
      .select()
      .from(facilityLayouts)
      .where(
        and(
          eq(facilityLayouts.organizationId, organizationId),
          eq(facilityLayouts.facilityId, facilityId),
        ),
      )
      .orderBy(desc(facilityLayouts.version))
      .limit(1);

    const areaRows = await tx
      .select()
      .from(facilityAreas)
      .where(
        and(
          eq(facilityAreas.organizationId, organizationId),
          eq(facilityAreas.facilityId, facilityId),
        ),
      )
      .orderBy(asc(facilityAreas.name));

    const assetRows = await tx
      .select({
        id: assets.id,
        name: assets.name,
        assetType: assets.assetType,
        status: assets.status,
        areaId: assets.areaId,
        areaName: facilityAreas.name,
        positionX: assets.positionX,
        positionY: assets.positionY,
        positionZ: assets.positionZ,
        rotationX: assets.rotationX,
        rotationY: assets.rotationY,
        rotationZ: assets.rotationZ,
        modelUrl: assets.modelUrl,
        metadata: assets.metadata,
      })
      .from(assets)
      .leftJoin(facilityAreas, eq(facilityAreas.id, assets.areaId))
      .where(and(eq(assets.organizationId, organizationId), eq(assets.facilityId, facilityId)))
      .orderBy(asc(assets.name));

    const assetSamples = await tx.execute<SampleRow>(sql`
      select distinct on (asset_id) asset_id, metric_value, unit, recorded_at
      from operational_metrics
      where organization_id = ${organizationId}
        and facility_id = ${facilityId}
        and asset_id is not null
        and metric_type = 'utilization'
      order by asset_id, recorded_at desc
    `);

    const areaSamples = await tx.execute<SampleRow>(sql`
      select distinct on (area_id) area_id, metric_value, unit, recorded_at
      from operational_metrics
      where organization_id = ${organizationId}
        and facility_id = ${facilityId}
        and area_id is not null
        and asset_id is null
        and metric_type = 'utilization'
      order by area_id, recorded_at desc
    `);

    const eventRows = await tx
      .select({
        id: assetEvents.id,
        assetId: assetEvents.assetId,
        areaId: assetEvents.areaId,
        eventType: assetEvents.eventType,
        severity: assetEvents.severity,
        description: assetEvents.description,
        occurredAt: assetEvents.occurredAt,
      })
      .from(assetEvents)
      .where(
        and(eq(assetEvents.organizationId, organizationId), eq(assetEvents.facilityId, facilityId)),
      )
      .orderBy(desc(assetEvents.occurredAt));

    const assetSampleById = new Map(
      assetSamples.rows
        .filter((row) => row.asset_id)
        .map((row) => [
          row.asset_id as string,
          toSample(row.metric_value, row.unit, row.recorded_at),
        ]),
    );
    const areaSampleById = new Map(
      areaSamples.rows
        .filter((row) => row.area_id)
        .map((row) => [
          row.area_id as string,
          toSample(row.metric_value, row.unit, row.recorded_at),
        ]),
    );

    const areas: SceneArea[] = areaRows.map((area) => ({
      id: area.id,
      name: area.name,
      areaType: area.areaType,
      position: {
        x: asImportedNumber(area.positionX),
        y: asImportedNumber(area.positionY),
        z: asImportedNumber(area.positionZ),
      },
      size: {
        width: asImportedNumber(area.width, 1),
        height: asImportedNumber(area.height, 1),
        depth: asImportedNumber(area.depth, 1),
      },
      latestUtilization: areaSampleById.get(area.id) ?? null,
    }));

    const sceneAssets: SceneAsset[] = assetRows.map((asset) => {
      const metadata = asset.metadata ?? {};
      const rackName = typeof metadata.rackName === "string" ? metadata.rackName : null;
      const level = typeof metadata.level === "number" ? metadata.level : null;
      return {
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType as AssetCategory,
        status: asset.status,
        areaId: asset.areaId,
        areaName: asset.areaName,
        position: {
          x: asImportedNumber(asset.positionX),
          y: asImportedNumber(asset.positionY),
          z: asImportedNumber(asset.positionZ),
        },
        rotationDegrees: {
          x: asImportedNumber(asset.rotationX),
          y: asImportedNumber(asset.rotationY),
          z: asImportedNumber(asset.rotationZ),
        },
        modelUrl: asset.modelUrl,
        rackName,
        level,
        latestUtilization: assetSampleById.get(asset.id) ?? null,
      };
    });

    const events: SceneEvent[] = eventRows.map((event) => ({
      id: event.id,
      assetId: event.assetId,
      areaId: event.areaId,
      eventType: event.eventType,
      severity: event.severity,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
    }));

    return {
      facility: {
        id: facility.id,
        name: facility.name,
        location: facility.location,
        facilityType: facility.facilityType,
      },
      layout: layout
        ? {
            id: layout.id,
            name: layout.name,
            version: layout.version,
            createdAt: layout.createdAt.toISOString(),
          }
        : null,
      bounds: readBounds(layout?.layoutData, facility.metadata) ?? boundsFromAreas(areas),
      areas,
      assets: sceneAssets,
      events,
    };
  });
}

function asImportedNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

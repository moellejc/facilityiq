import "server-only";

import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { integrationCreateSchema, integrationUpdateSchema } from "@/lib/validation";

import {
  deleteIntegration,
  insertIntegration,
  listIntegrations,
  updateIntegration,
  type IntegrationPatch,
} from "../repositories/integrations";
import type { RequestContext } from "./context";

function presentIntegration(integration: {
  id: string;
  name: string;
  provider: string;
  status: string;
  externalReference: string | null;
}) {
  return {
    id: integration.id,
    name: integration.name,
    provider: integration.provider,
    status: integration.status,
    externalReference: integration.externalReference,
  };
}

export async function listIntegrationRecords(
  context: RequestContext,
  query: { page: number; limit: number },
) {
  assertRole(context.role, "integrations:manage");
  const page = await listIntegrations(
    context.organizationId,
    context.userId,
    query.page,
    query.limit,
  );
  return {
    data: page.data.map(presentIntegration),
    page: page.page,
    limit: page.limit,
    total: page.total,
  };
}

export async function createIntegrationRecord(context: RequestContext, input: unknown) {
  assertRole(context.role, "integrations:manage");
  const parsed = integrationCreateSchema.parse(input);
  const result = await insertIntegration(context.organizationId, context.userId, {
    name: parsed.name,
    provider: parsed.provider,
    status: parsed.status,
    externalReference: parsed.externalReference ?? null,
  });
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "An integration with that name already exists.", 409);
  }
  return { data: presentIntegration(result.integration) };
}

export async function updateIntegrationRecord(
  context: RequestContext,
  integrationId: string,
  input: unknown,
) {
  assertRole(context.role, "integrations:manage");
  const parsed = integrationUpdateSchema.parse(input);
  const patch: IntegrationPatch = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.provider !== undefined) patch.provider = parsed.provider;
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.externalReference !== undefined) patch.externalReference = parsed.externalReference;
  const result = await updateIntegration(
    context.organizationId,
    context.userId,
    integrationId,
    patch,
  );
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Integration not found.", 404);
  if (result.status === "conflict") {
    throw new AppError("CONFLICT", "An integration with that name already exists.", 409);
  }
  return { data: presentIntegration(result.integration) };
}

export async function removeIntegrationRecord(context: RequestContext, integrationId: string) {
  assertRole(context.role, "integrations:manage");
  const result = await deleteIntegration(context.organizationId, context.userId, integrationId);
  if (result.status === "missing") throw new AppError("NOT_FOUND", "Integration not found.", 404);
  return { data: { id: result.integration.id } };
}

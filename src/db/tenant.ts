import { sql } from "drizzle-orm";

import { getDb, type Database } from "./index";

export type TenantScope = {
  organizationId: string;
  userId?: string | null;
};

export type TenantTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Runs `fn` in a transaction with the tenant GUCs set locally.
 * Repositories still filter by organizationId. The settings exist so PostgreSQL
 * row-level security applies when the connection role is not a superuser.
 */
export async function withTenant<T>(scope: TenantScope, fn: (tx: TenantTx) => Promise<T>) {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_organization_id', ${scope.organizationId}, true)`,
    );
    if (scope.userId) {
      await tx.execute(sql`select set_config('app.current_user_id', ${scope.userId}, true)`);
    }
    return fn(tx);
  });
}

export async function withUser<T>(userId: string, fn: (tx: TenantTx) => Promise<T>) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}

import { createHash } from "node:crypto";

export function deterministicUuid(name: string) {
  const hash = createHash("sha256").update(`facilityiq.v1:${name}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const DEMO_PASSWORD = "FacilityIQ-demo-2026";
export const ORG_SLUG = "acme-manufacturing";
export const PERIOD_END = "2026-11-01";
export const SEEDED_AT = new Date("2026-01-15T15:00:00.000Z");

export const DEMO_USERS = [
  {
    key: "admin",
    email: "admin@acme.example",
    name: "Avery Chen",
    role: "org_admin",
  },
  {
    key: "operations",
    email: "operations@acme.example",
    name: "Owen Brooks",
    role: "operations_manager",
  },
  {
    key: "finance",
    email: "finance@acme.example",
    name: "Priya Shah",
    role: "finance_manager",
  },
  {
    key: "viewer",
    email: "viewer@acme.example",
    name: "Riley Nguyen",
    role: "viewer",
  },
] as const;

export const organizationId = deterministicUuid("org:acme-manufacturing");
export const facilityId = deterministicUuid("facility:west-distribution-center");

export function userId(email: string) {
  return deterministicUuid(`user:${email}`);
}

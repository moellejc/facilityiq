import { AppError } from "@/lib/errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseQuickSearchQuery(input: { q: string; organizationId: string }) {
  const q = input.q.trim();
  const organizationId = input.organizationId.trim();
  if (q.length < 2 || q.length > 40) {
    throw new AppError("VALIDATION_ERROR", "q must be between 2 and 40 characters", 400);
  }
  if (!/^[A-Za-z0-9 ]+$/.test(q)) {
    throw new AppError("VALIDATION_ERROR", "q may only contain letters, numbers, and spaces", 400);
  }
  if (!UUID_PATTERN.test(organizationId)) {
    throw new AppError("VALIDATION_ERROR", "organizationId must be a uuid query parameter", 400);
  }
  return { q, organizationId };
}

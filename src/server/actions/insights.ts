"use server";

import { revalidatePath } from "next/cache";

import { isAppError } from "@/lib/errors";

import { requireRequestContext } from "../services/context";
import { generateFacilityInsights, setInsightStatus } from "../services/insight-service";

export async function regenerateInsightsAction(formData: FormData) {
  const context = await requireRequestContext();
  if (!context.facilityId) {
    throw new Error("Choose a facility first.");
  }
  try {
    await generateFacilityInsights({
      organizationId: context.organizationId,
      userId: context.userId,
      facilityId: context.facilityId,
      role: context.role,
      query: {
        from: String(formData.get("from") ?? ""),
        to: String(formData.get("to") ?? ""),
      },
    });
  } catch (error) {
    if (isAppError(error)) throw new Error(error.message);
    throw error;
  }
  revalidatePath("/insights");
  revalidatePath("/facilities/twin");
}

export async function updateInsightStatusAction(formData: FormData) {
  const context = await requireRequestContext();
  if (!context.facilityId) return;
  const status = String(formData.get("status") ?? "");
  if (status !== "open" && status !== "acknowledged" && status !== "dismissed") return;
  try {
    await setInsightStatus({
      organizationId: context.organizationId,
      userId: context.userId,
      facilityId: context.facilityId,
      role: context.role,
      insightId: String(formData.get("insightId") ?? ""),
      status,
    });
  } catch (error) {
    if (isAppError(error)) throw new Error(error.message);
    throw error;
  }
  revalidatePath("/insights");
}

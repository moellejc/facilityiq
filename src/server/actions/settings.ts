"use server";

import { revalidatePath } from "next/cache";

import { isAppError } from "@/lib/errors";

import { requireRequestContext } from "../services/context";
import { changeMemberRole, renameOrganization } from "../services/organization-service";

export type SettingsState = { error?: string; ok?: string };

export async function renameOrganizationAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    const context = await requireRequestContext();
    const organization = await renameOrganization(context, { name: formData.get("name") });
    revalidatePath("/", "layout");
    return { ok: `Organization renamed to ${organization.name}.` };
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    return { error: "The organization name could not be saved." };
  }
}

export async function changeMemberRoleAction(formData: FormData) {
  const context = await requireRequestContext();
  await changeMemberRole(context, {
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  revalidatePath("/settings");
}

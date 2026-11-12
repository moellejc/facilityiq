"use server";

import { revalidatePath } from "next/cache";

import { requireRequestContext } from "../services/context";
import {
  createFacilityRecord,
  removeFacilityRecord,
  updateFacilityRecord,
} from "../services/facility-service";
import {
  createIntegrationRecord,
  removeIntegrationRecord,
  updateIntegrationRecord,
} from "../services/integration-service";
import {
  addOrganizationMember,
  changeMemberRole,
  removeOrganizationMember,
  renameOrganization,
} from "../services/organization-service";
import { actionError, type ActionState } from "./action-state";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  return value;
}

export async function renameOrganizationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const organization = await renameOrganization(context, { name: text(formData, "name") });
    revalidatePath("/", "layout");
    return { ok: `Organization renamed to ${organization.name}.` };
  } catch (error) {
    return actionError(error, "The organization name could not be saved.");
  }
}

export async function changeMemberRoleAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    await changeMemberRole(context, {
      memberId: text(formData, "memberId"),
      role: text(formData, "role"),
    });
    revalidatePath("/", "layout");
    return { ok: "Role updated." };
  } catch (error) {
    return actionError(error, "The role could not be updated.");
  }
}

export async function addMemberAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const member = await addOrganizationMember(context, {
      email: text(formData, "email"),
      role: text(formData, "role"),
    });
    revalidatePath("/admin");
    return { ok: `${member.email} was added.` };
  } catch (error) {
    return actionError(error, "The member could not be added.");
  }
}

export async function removeMemberAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    await removeOrganizationMember(context, { memberId: text(formData, "memberId") });
    revalidatePath("/", "layout");
    return { ok: "Member removed." };
  } catch (error) {
    return actionError(error, "The member could not be removed.");
  }
}

export async function createFacilityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const facility = await createFacilityRecord(context, {
      name: text(formData, "name"),
      location: optionalText(formData, "location"),
      facilityType: text(formData, "facilityType"),
      squareFootage: optionalText(formData, "squareFootage"),
      timezone: text(formData, "timezone"),
    });
    revalidatePath("/", "layout");
    return { ok: `${facility.data.name} was added.` };
  } catch (error) {
    return actionError(error, "The facility could not be added.");
  }
}

export async function updateFacilityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const facility = await updateFacilityRecord(context, text(formData, "facilityId"), {
      name: text(formData, "name"),
      location: optionalText(formData, "location"),
      facilityType: text(formData, "facilityType"),
      squareFootage: optionalText(formData, "squareFootage"),
      timezone: text(formData, "timezone"),
    });
    revalidatePath("/", "layout");
    return { ok: `${facility.data.name} was saved.` };
  } catch (error) {
    return actionError(error, "The facility could not be saved.");
  }
}

export async function removeFacilityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    await removeFacilityRecord(context, text(formData, "facilityId"));
    revalidatePath("/", "layout");
    return { ok: "Facility removed." };
  } catch (error) {
    return actionError(error, "The facility could not be removed.");
  }
}

export async function createIntegrationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const integration = await createIntegrationRecord(context, {
      name: text(formData, "name"),
      provider: text(formData, "provider"),
      status: text(formData, "status"),
      externalReference: optionalText(formData, "externalReference"),
    });
    revalidatePath("/admin");
    return { ok: `${integration.data.name} was added.` };
  } catch (error) {
    return actionError(error, "The integration could not be added.");
  }
}

export async function updateIntegrationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    const integration = await updateIntegrationRecord(context, text(formData, "integrationId"), {
      name: text(formData, "name"),
      provider: text(formData, "provider"),
      status: text(formData, "status"),
      externalReference: optionalText(formData, "externalReference"),
    });
    revalidatePath("/admin");
    return { ok: `${integration.data.name} was saved.` };
  } catch (error) {
    return actionError(error, "The integration could not be saved.");
  }
}

export async function removeIntegrationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const context = await requireRequestContext();
    await removeIntegrationRecord(context, text(formData, "integrationId"));
    revalidatePath("/admin");
    return { ok: "Integration removed." };
  } catch (error) {
    return actionError(error, "The integration could not be removed.");
  }
}

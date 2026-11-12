"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FACILITY_TYPE_LABELS, FACILITY_TYPES, type FacilityType } from "@/lib/facilities";
import {
  createFacilityAction,
  removeFacilityAction,
  updateFacilityAction,
} from "@/server/actions/admin";

type FormState = { error?: string; ok?: string };

const controlClass = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm";

export type AdminFacility = {
  id: string;
  name: string;
  location: string | null;
  facilityType: string;
  squareFootage: string | null;
  timezone: string;
};

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

function facilityTypeValue(value: string): FacilityType {
  return FACILITY_TYPES.find((type) => type === value) ?? "warehouse";
}

function FacilityFields({ facility, idPrefix }: { facility?: AdminFacility; idPrefix: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={facility?.name ?? ""}
          required
          minLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-location`}>Location</Label>
        <Input
          id={`${idPrefix}-location`}
          name="location"
          defaultValue={facility?.location ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <select
          id={`${idPrefix}-type`}
          name="facilityType"
          defaultValue={facility ? facilityTypeValue(facility.facilityType) : "warehouse"}
          className={controlClass}
        >
          {FACILITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {FACILITY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-area`}>Square footage</Label>
        <Input
          id={`${idPrefix}-area`}
          name="squareFootage"
          inputMode="decimal"
          defaultValue={facility?.squareFootage ?? ""}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-timezone`}>Timezone</Label>
        <Input
          id={`${idPrefix}-timezone`}
          name="timezone"
          defaultValue={facility?.timezone ?? "America/Los_Angeles"}
          required
        />
      </div>
    </div>
  );
}

function CreateFacilityForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createFacilityAction, {});
  return (
    <form action={action} className="space-y-3">
      <FacilityFields idPrefix="new-facility" />
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add facility"}
      </Button>
    </form>
  );
}

function UpdateFacilityForm({ facility }: { facility: AdminFacility }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateFacilityAction, {});
  return (
    <form
      action={action}
      className="space-y-3"
      key={`${facility.id}:${facility.name}:${facility.location ?? ""}:${facility.facilityType}:${facility.squareFootage ?? ""}:${facility.timezone}`}
    >
      <input type="hidden" name="facilityId" value={facility.id} />
      <FacilityFields facility={facility} idPrefix={`facility-${facility.id}`} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save facility"}
      </Button>
    </form>
  );
}

function RemoveFacilityForm({ facility }: { facility: AdminFacility }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeFacilityAction, {});
  return (
    <form action={action} className="space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="facilityId" value={facility.id} />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="confirm" required className="mt-1" />
        <span>
          Remove {facility.name} and its stored areas, assets, layouts, metrics, and scenarios.
        </span>
      </label>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove facility"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function FacilitiesPanel({ facilities }: { facilities: AdminFacility[] }) {
  return (
    <div className="space-y-6">
      <CreateFacilityForm />
      {facilities.length === 0 ? (
        <p className="text-sm text-slate-600">This organization does not have a facility yet.</p>
      ) : (
        <div className="space-y-4">
          {facilities.map((facility) => (
            <div key={facility.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <UpdateFacilityForm facility={facility} />
              <RemoveFacilityForm facility={facility} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

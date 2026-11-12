"use client";

import { useActionState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FACILITY_TYPE_LABELS,
  FACILITY_TYPES,
  type FacilityAddress,
  type FacilityType,
} from "@/lib/facilities";
import {
  createFacilityAction,
  removeFacilityAction,
  updateFacilityAction,
  updateFacilityAddressAction,
} from "@/server/actions/admin";
import type { ActionState } from "@/server/actions/action-state";

type FormState = ActionState;

const controlClass = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm";

export type AdminFacility = {
  id: string;
  name: string;
  location: string | null;
  facilityType: string;
  squareFootage: string | null;
  timezone: string;
  address: FacilityAddress | null;
};

const ADDRESS_INPUTS = [
  {
    name: "addressStreet",
    label: "Street",
    autoComplete: "street-address",
    maxLength: 200,
    value: (address: FacilityAddress) => address.street,
  },
  {
    name: "addressCity",
    label: "City",
    autoComplete: "address-level2",
    maxLength: 120,
    value: (address: FacilityAddress) => address.city,
  },
  {
    name: "addressRegion",
    label: "Region or state",
    autoComplete: "address-level1",
    maxLength: 120,
    value: (address: FacilityAddress) => address.region,
  },
  {
    name: "addressPostalCode",
    label: "Postal code",
    autoComplete: "postal-code",
    maxLength: 20,
    value: (address: FacilityAddress) => address.postalCode,
  },
  {
    name: "addressCountry",
    label: "Country",
    autoComplete: "country-name",
    maxLength: 80,
    value: (address: FacilityAddress) => address.country,
  },
] as const;

function Feedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-rose-600">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

function AddressFields({
  idPrefix,
  address,
  required,
  fieldErrors,
}: {
  idPrefix: string;
  address?: FacilityAddress | null;
  required: boolean;
  fieldErrors?: Record<string, string>;
}) {
  return (
    <fieldset className="grid gap-3 md:grid-cols-2">
      <legend className="mb-1 text-sm font-medium text-slate-950">Street address</legend>
      {ADDRESS_INPUTS.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const error = fieldErrors?.[field.name];
        const errorId = `${id}-error`;
        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={id}>{field.label}</Label>
            <Input
              id={id}
              name={field.name}
              autoComplete={field.autoComplete}
              maxLength={field.maxLength}
              required={required}
              defaultValue={address ? field.value(address) : ""}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} className="text-sm text-rose-600">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function facilityTypeValue(value: string): FacilityType {
  return FACILITY_TYPES.find((type) => type === value) ?? "warehouse";
}

function FacilityFields({
  facility,
  idPrefix,
  includeAddress = false,
  fieldErrors,
}: {
  facility?: AdminFacility;
  idPrefix: string;
  includeAddress?: boolean;
  fieldErrors?: Record<string, string>;
}) {
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
      {includeAddress ? (
        <div className="md:col-span-2">
          <AddressFields idPrefix={idPrefix} required={false} fieldErrors={fieldErrors} />
          <p className="mt-2 text-xs text-slate-500">
            Leave the street address blank, or fill in street, city, region or state, postal code,
            and country.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CreateFacilityForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createFacilityAction, {});
  return (
    <form action={action} className="space-y-3">
      <FacilityFields idPrefix="new-facility" includeAddress fieldErrors={state.fieldErrors} />
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

function AddressSubmitButton({
  busy,
  pendingLabel,
  children,
  ...props
}: ComponentProps<typeof Button> & { busy: boolean; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={busy || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function FacilityAddressForm({ facility }: { facility: AdminFacility }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateFacilityAddressAction,
    {},
  );
  const stored = facility.address;
  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Current street address
        </p>
        {stored ? (
          <p className="text-sm text-slate-700">
            {stored.street}, {stored.city}, {stored.region} {stored.postalCode}, {stored.country}
          </p>
        ) : (
          <p className="text-sm text-slate-600">No street address yet.</p>
        )}
      </div>
      <form
        action={action}
        className="space-y-3"
        key={`${facility.id}:${stored?.street ?? ""}:${stored?.city ?? ""}:${stored?.region ?? ""}:${stored?.postalCode ?? ""}:${stored?.country ?? ""}`}
      >
        <input type="hidden" name="facilityId" value={facility.id} />
        <AddressFields
          idPrefix={`address-${facility.id}`}
          address={stored}
          required
          fieldErrors={state.fieldErrors}
        />
        <AddressSubmitButton busy={pending} pendingLabel="Saving address…">
          Save street address
        </AddressSubmitButton>
      </form>
      {stored ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="facilityId" value={facility.id} />
          <input type="hidden" name="clearAddress" value="true" />
          <AddressSubmitButton
            busy={pending}
            pendingLabel="Removing address…"
            variant="outline"
            size="sm"
          >
            Clear street address
          </AddressSubmitButton>
        </form>
      ) : null}
      <Feedback state={state} />
    </div>
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
              <FacilityAddressForm facility={facility} />
              <RemoveFacilityForm facility={facility} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

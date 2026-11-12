import { ZodError } from "zod";

export type AddressLines = {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

type FormReader = { get(name: string): unknown };

const ADDRESS_FIELDS = {
  "address.street": "addressStreet",
  "address.city": "addressCity",
  "address.region": "addressRegion",
  "address.postalCode": "addressPostalCode",
  "address.country": "addressCountry",
} as const;

function field(formData: FormReader, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function addressLinesFromForm(formData: FormReader): AddressLines {
  return {
    street: field(formData, "addressStreet"),
    city: field(formData, "addressCity"),
    region: field(formData, "addressRegion"),
    postalCode: field(formData, "addressPostalCode"),
    country: field(formData, "addressCountry"),
  };
}

export function addressProvided(address: AddressLines) {
  return Boolean(
    address.street || address.city || address.region || address.postalCode || address.country,
  );
}

/** Blank address fields are omitted so creating a facility does not send an empty address. */
export function addressCreatePatch(
  formData: FormReader,
): { address: AddressLines } | Record<string, never> {
  const address = addressLinesFromForm(formData);
  return addressProvided(address) ? { address } : {};
}

/** `clearAddress=true` clears the stored address. Any other submit sends the five lines. */
export function addressUpdateBody(formData: FormReader): { address: AddressLines | null } {
  if (formData.get("clearAddress") === "true") return { address: null };
  return { address: addressLinesFromForm(formData) };
}

export function addressFieldErrors(
  error: unknown,
): { error: string; fieldErrors?: Record<string, string> } | null {
  if (!(error instanceof ZodError)) return null;
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = ADDRESS_FIELDS[issue.path.join(".") as keyof typeof ADDRESS_FIELDS];
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return {
    error: Object.values(fieldErrors)[0] ?? "The request is invalid.",
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
  };
}

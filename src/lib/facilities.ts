export const FACILITY_TYPES = ["warehouse", "distribution_center", "plant", "other"] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number];

export type FacilityAddress = {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type FacilityAddressColumns = {
  addressStreet: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
};

export type FacilitySummary = {
  id: string;
  name: string;
  location: string | null;
  facilityType: string;
  squareFootage: string | null;
  timezone: string;
  address: FacilityAddress | null;
};

/** A stored address is shown only when street, city, region, postal code, and country are all set. */
export function presentFacilityAddress(row: FacilityAddressColumns): FacilityAddress | null {
  const street = row.addressStreet;
  const city = row.addressCity;
  const region = row.addressRegion;
  const postalCode = row.addressPostalCode;
  const country = row.addressCountry;
  if (!street || !city || !region || !postalCode || !country) return null;
  return { street, city, region, postalCode, country };
}

export function toFacilitySummary(
  facility: FacilityAddressColumns & Omit<FacilitySummary, "address">,
): FacilitySummary {
  return {
    id: facility.id,
    name: facility.name,
    location: facility.location,
    facilityType: facility.facilityType,
    squareFootage: facility.squareFootage,
    timezone: facility.timezone,
    address: presentFacilityAddress(facility),
  };
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  warehouse: "Warehouse",
  distribution_center: "Distribution center",
  plant: "Plant",
  other: "Other",
};

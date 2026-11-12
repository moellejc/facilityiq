export const FACILITY_TYPES = ["warehouse", "distribution_center", "plant", "other"] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  warehouse: "Warehouse",
  distribution_center: "Distribution center",
  plant: "Plant",
  other: "Other",
};

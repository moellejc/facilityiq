const numberFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCount(value: number) {
  return numberFormat.format(value);
}

export function formatSquareFeet(value: string | null) {
  if (!value) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${numberFormat.format(parsed)} sq ft`;
}

export function formatUtcDate(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormat.format(date);
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  storage_rack: "Storage racks",
  pallet: "Pallets",
  loading_dock: "Loading docks",
  packing_station: "Packing stations",
  conveyor: "Conveyors",
  forklift: "Forklifts",
};

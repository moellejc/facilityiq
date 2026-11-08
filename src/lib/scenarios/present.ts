import type { ScenarioFigure } from "./types";

export function formatScenarioFigure(value: ScenarioFigure) {
  if (value.value === null) {
    if (value.unavailableReason === "zero_denominator") return "Unavailable — division by zero";
    if (value.unavailableReason === "empty_period") return "Unavailable — no stored samples";
    return "Unavailable — missing inputs";
  }
  const amount =
    value.unit === "ratio"
      ? `${(value.value * 100).toFixed(1)}%`
      : value.unit === "USD" || value.unit.startsWith("USD")
        ? value.value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : value.value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const unit = value.unit === "ratio" ? "" : ` ${value.unit}`;
  const basis = value.basis === "modeled" ? "Modeled estimate" : "Observed";
  return `${amount}${unit} · ${basis}`;
}

export const SCENARIO_KIND_LABELS: Record<string, string> = {
  add_packing_station: "Add a packing station",
  increase_conveyor_capacity: "Increase conveyor capacity",
  extend_operating_hours: "Extend operating hours",
  reassign_equipment: "Reassign equipment",
  increase_staffing: "Increase staffing",
  reduce_downtime: "Reduce equipment downtime",
};

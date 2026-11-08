import type { ScenarioFigure, ScenarioProjection } from "./types";

export type ComparisonColumn = {
  id: string;
  title: string;
  basis: "observed" | "modeled";
  throughputOrdersPerDay: ScenarioFigure;
  throughputOrdersPerHour: ScenarioFigure;
  operatingCost: ScenarioFigure;
  costPerOrder: ScenarioFigure;
  monthlySavings: ScenarioFigure | null;
  roi: ScenarioFigure | null;
};

export function compareScenarioProjections(input: {
  left: { id: string; name: string; projection: ScenarioProjection };
  right?: { id: string; name: string; projection: ScenarioProjection } | null;
}): ComparisonColumn[] {
  if (!input.right) {
    return [
      column(
        `${input.left.id}:baseline`,
        "Observed baseline",
        input.left.projection.baseline,
        null,
        null,
      ),
      column(
        `${input.left.id}:projected`,
        `${input.left.name} · modeled`,
        input.left.projection.projected,
        input.left.projection.monthlySavings,
        input.left.projection.roi,
      ),
    ];
  }
  return [
    column(
      input.left.id,
      `${input.left.name} · modeled`,
      input.left.projection.projected,
      input.left.projection.monthlySavings,
      input.left.projection.roi,
    ),
    column(
      input.right.id,
      `${input.right.name} · modeled`,
      input.right.projection.projected,
      input.right.projection.monthlySavings,
      input.right.projection.roi,
    ),
  ];
}

function column(
  id: string,
  title: string,
  block: ScenarioProjection["baseline"],
  monthlySavings: ScenarioFigure | null,
  roi: ScenarioFigure | null,
): ComparisonColumn {
  return {
    id,
    title,
    basis: block.basis,
    throughputOrdersPerDay: block.throughputOrdersPerDay,
    throughputOrdersPerHour: block.throughputOrdersPerHour,
    operatingCost: block.operatingCost,
    costPerOrder: block.costPerOrder,
    monthlySavings,
    roi,
  };
}

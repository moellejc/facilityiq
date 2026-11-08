import {
  costPerOrder,
  throughputOrdersPerDay,
  throughputOrdersPerHour,
} from "@/lib/analytics/kpis";

import type { ScenarioConfiguration } from "./schema";
import {
  figure,
  unavailableFigure,
  type PerformanceBlock,
  type ScenarioAsset,
  type ScenarioBaseline,
  type ScenarioFigure,
  type ScenarioHighlight,
  type ScenarioProjection,
} from "./types";

const MONTH_DAYS = 30;

export function projectScenario(
  baseline: ScenarioBaseline,
  configuration: ScenarioConfiguration,
): ScenarioProjection {
  switch (configuration.kind) {
    case "add_packing_station":
      return projectAddPackingStation(baseline, configuration.parameters);
    case "increase_conveyor_capacity":
      return projectIncreaseConveyorCapacity(baseline, configuration.parameters);
    case "extend_operating_hours":
      return projectExtendOperatingHours(baseline, configuration.parameters);
    case "reassign_equipment":
      return projectReassignEquipment(baseline, configuration.parameters);
    case "increase_staffing":
      return projectIncreaseStaffing(baseline, configuration.parameters);
    case "reduce_downtime":
      return projectReduceDowntime(baseline, configuration.parameters);
  }
}

export function projectAddPackingStation(
  baseline: ScenarioBaseline,
  parameters: {
    additionalStations: number;
    referenceAssetId?: string | null;
    modeledMonthlyCostPerStation?: number | null;
    modeledInvestment?: number | null;
  },
): ScenarioProjection {
  const stations = baseline.assets.filter((asset) => asset.assetType === "packing_station");
  const reference = pickReference(stations, parameters.referenceAssetId);
  const peers = stations.filter(
    (asset) => asset.assetId !== reference?.assetId && asset.ordersPerDay !== null,
  );
  const peerMedian = median(peers.map((asset) => asset.ordersPerDay as number));
  const gap =
    reference?.ordersPerDay !== null && reference?.ordersPerDay !== undefined && peerMedian !== null
      ? Math.max(0, peerMedian - reference.ordersPerDay)
      : null;
  const recoveredPerDay =
    gap === null ? null : Math.min(gap, (peerMedian as number) * parameters.additionalStations);
  const reason =
    stations.length === 0
      ? "empty_period"
      : peers.length === 0 || reference?.ordersPerDay == null
        ? "missing_inputs"
        : null;

  const incremental = monthlyToPeriod(
    parameters.modeledMonthlyCostPerStation == null
      ? null
      : parameters.modeledMonthlyCostPerStation * parameters.additionalStations,
    baseline.periodDays,
  );
  const modeledCost = addCost(baseline.operatingCost, incremental);
  const throughput = projectThroughput(baseline, recoveredPerDay, reason ?? "missing_inputs");
  const resolvedCost =
    parameters.modeledMonthlyCostPerStation == null
      ? copyFigure(observedBlock(baseline).operatingCost)
      : modeledCost === null
        ? unavailableFigure(
            "USD",
            baseline.operatingCost === null ? "empty_period" : "missing_inputs",
            "modeled",
          )
        : figure(roundMoney(modeledCost), "USD", "modeled");
  const highlights: ScenarioHighlight[] = [
    {
      label: "Reference station orders per day",
      figure:
        reference?.ordersPerDay == null
          ? unavailableFigure("orders/day", reason ?? "missing_inputs", "observed")
          : figure(round4(reference.ordersPerDay), "orders/day", "observed"),
    },
    {
      label: "Peer median orders per day",
      figure:
        peerMedian === null
          ? unavailableFigure("orders/day", "missing_inputs", "observed")
          : figure(round4(peerMedian), "orders/day", "observed"),
    },
    {
      label: "Recovered orders per day",
      figure:
        recoveredPerDay === null
          ? unavailableFigure("orders/day", reason ?? "missing_inputs", "modeled")
          : figure(round4(recoveredPerDay), "orders/day", "modeled"),
    },
  ];

  return assemble(baseline, "add_packing_station", throughput, null, highlights, {
    investment: parameters.modeledInvestment ?? null,
    costAlreadyResolved: true,
    resolvedCost,
    assumptions: [
      "Recovered orders per day are the gap between the reference packing station and the median orders per day of the other packing stations.",
      "The gap is capped at peer median times the number of new stations. Station orders are not already inside the facility total, so the gap is added to facility throughput.",
      parameters.modeledMonthlyCostPerStation == null
        ? "No monthly station cost was entered. Operating cost stays at the observed total and savings are not claimed."
        : `Each new station adds a modeled ${parameters.modeledMonthlyCostPerStation} USD per month. That cost is not in the ledger.`,
    ],
    limitations: [
      reference
        ? `Reference station is ${reference.name}.`
        : "No packing station with stored orders was found.",
      peers.length === 0
        ? "No peer packing station has stored orders, so the gap cannot be calculated."
        : "",
      "Recovered demand is a model. It is not a booked order increase.",
    ].filter(Boolean),
  });
}

export function projectIncreaseConveyorCapacity(
  baseline: ScenarioBaseline,
  parameters: {
    assetId: string;
    capacityIncreasePercent: number;
    modeledMonthlyCost?: number | null;
    modeledInvestment?: number | null;
  },
): ScenarioProjection {
  const asset = baseline.assets.find((item) => item.assetId === parameters.assetId);
  const wrongType = asset && asset.assetType !== "conveyor";
  const utilization = !asset || wrongType ? null : asset.utilization;
  const gain =
    utilization === null ? null : (parameters.capacityIncreasePercent / 100) * (utilization / 100);
  const extraPerDay = scaleOrdersPerDay(baseline, gain);
  const incremental = monthlyToPeriod(parameters.modeledMonthlyCost ?? null, baseline.periodDays);
  const modeledCost =
    parameters.modeledMonthlyCost == null ? null : addCost(baseline.operatingCost, incremental);
  const throughput = projectThroughput(
    baseline,
    extraPerDay,
    asset
      ? wrongType
        ? "missing_inputs"
        : utilization === null
          ? "empty_period"
          : "missing_inputs"
      : "empty_period",
  );
  const resolvedCost =
    parameters.modeledMonthlyCost == null
      ? copyFigure(observedBlock(baseline).operatingCost)
      : modeledCost === null
        ? unavailableFigure(
            "USD",
            baseline.operatingCost === null ? "empty_period" : "missing_inputs",
            "modeled",
          )
        : figure(roundMoney(modeledCost), "USD", "modeled");

  return assemble(
    baseline,
    "increase_conveyor_capacity",
    throughput,
    null,
    [
      {
        label: asset ? `${asset.name} utilization` : "Conveyor utilization",
        figure:
          utilization === null
            ? unavailableFigure("percent", "empty_period", "observed")
            : figure(round4(utilization), "percent", "observed"),
      },
      {
        label: "Modeled throughput gain",
        figure:
          gain === null
            ? unavailableFigure("ratio", "missing_inputs", "modeled")
            : figure(round4(gain), "ratio", "modeled"),
      },
    ],
    {
      investment: parameters.modeledInvestment ?? null,
      costAlreadyResolved: true,
      resolvedCost,
      assumptions: [
        "Throughput gain fraction equals the capacity increase times the conveyor's observed utilization. Idle capacity does not create orders.",
        parameters.modeledMonthlyCost == null
          ? "No modeled monthly cost was entered, so operating cost stays at the observed total and savings are not claimed."
          : "The monthly cost is a modeled assumption, not a ledger row.",
      ],
      limitations: [
        !asset ? "That asset has no stored samples in the period." : "",
        wrongType ? "The asset is not a conveyor." : "",
        asset && utilization === null ? `${asset.name} has no utilization samples.` : "",
        "The gain assumes this conveyor constrains facility throughput. That constraint is not measured directly.",
      ].filter(Boolean),
    },
  );
}

export function projectExtendOperatingHours(
  baseline: ScenarioBaseline,
  parameters: { additionalHoursPerDay: number },
): ScenarioProjection {
  return projectAddedHours(baseline, parameters.additionalHoursPerDay, "extend_operating_hours", {
    assumptions: [
      "Extra hours produce orders at the observed orders-per-hour rate.",
      "Labor scales at the observed labor cost per operating hour. Other cost categories stay at their observed totals.",
      "No selling price is stored, so a negative savings figure is extra labor spend, not lost profit.",
    ],
    limitations: [
      "The model treats labor hours as the throughput constraint.",
      "ROI uses the extra monthly labor as the denominator. It is a modeled estimate.",
    ],
    highlights: [],
    investmentFromExtraLabor: true,
  });
}

export function projectIncreaseStaffing(
  baseline: ScenarioBaseline,
  parameters: {
    additionalHeadcount: number;
    hoursPerPersonPerDay?: number | null;
    modeledHourlyLaborRate?: number | null;
  },
): ScenarioProjection {
  const observedHoursPerDay = divideRaw(baseline.operatingHours, baseline.hourDays);
  const hoursPerPerson =
    parameters.hoursPerPersonPerDay ??
    (observedHoursPerDay.reason ? null : observedHoursPerDay.value);
  const additional =
    hoursPerPerson === null ? null : parameters.additionalHeadcount * hoursPerPerson;
  const rate =
    parameters.modeledHourlyLaborRate ??
    divideRaw(baseline.laborCost, baseline.operatingHours).value;
  const rateReason =
    parameters.modeledHourlyLaborRate == null
      ? divideRaw(baseline.laborCost, baseline.operatingHours).reason
      : null;

  if (additional === null || additional <= 0) {
    return blocked(
      baseline,
      "increase_staffing",
      ["Hours per person could not be taken from the period, and none were entered."],
      ["Staffing uses observed orders per hour and a labor rate."],
    );
  }

  const projection = projectAddedHours(baseline, additional, "increase_staffing", {
    assumptions: [
      `${parameters.additionalHeadcount} people × ${round4(hoursPerPerson as number)} hours each day.`,
      rateReason
        ? "The labor rate is unavailable, so cost cannot be scaled."
        : parameters.modeledHourlyLaborRate == null
          ? "The hourly labor rate is observed labor cost divided by observed operating hours."
          : "The hourly labor rate is a modeled assumption, not a ledger rate.",
      "Extra hours produce orders at the observed orders-per-hour rate. Other costs stay at observed totals.",
    ],
    limitations: [
      "Headcount is not stored, so hours per person default to the facility's observed hours per day when left blank.",
      "No selling price is stored. Savings are the change in operating cost, which is usually extra labor.",
    ],
    highlights: [
      {
        label: "Labor rate used",
        figure:
          rate === null || rateReason
            ? unavailableFigure(
                "USD/hour",
                rateReason ?? "missing_inputs",
                parameters.modeledHourlyLaborRate == null ? "observed" : "modeled",
              )
            : figure(
                round4(rate),
                "USD/hour",
                parameters.modeledHourlyLaborRate == null ? "observed" : "modeled",
              ),
      },
    ],
    investmentFromExtraLabor: true,
    laborRateOverride: rateReason ? null : rate,
  });
  return projection;
}

export function projectReassignEquipment(
  baseline: ScenarioBaseline,
  parameters: {
    assetIds: string[];
    destinationAreaId?: string | null;
    modeledCostPerDwellMinute?: number | null;
  },
): ScenarioProjection {
  const selected = baseline.assets.filter((asset) => parameters.assetIds.includes(asset.assetId));
  const types = new Set(selected.map((asset) => asset.assetType));
  if (selected.length === 0 || types.size !== 1) {
    return blocked(
      baseline,
      "reassign_equipment",
      [
        selected.length === 0
          ? "None of the selected assets have samples in this period."
          : "Select assets of a single type so peers are comparable.",
      ],
      [
        "Reassignment sets selected equipment to the median utilization of the unselected peers of the same type.",
      ],
    );
  }
  const assetType = selected[0]?.assetType ?? "asset";
  const peers = baseline.assets.filter(
    (asset) =>
      asset.assetType === assetType &&
      !parameters.assetIds.includes(asset.assetId) &&
      asset.utilization !== null,
  );
  const peerMedian = median(peers.map((asset) => asset.utilization as number));
  const selectedUtils = selected
    .map((asset) => asset.utilization)
    .filter((value): value is number => value !== null);
  const selectedMean =
    selectedUtils.length === 0
      ? null
      : selectedUtils.reduce((sum, value) => sum + value, 0) / selectedUtils.length;
  const idleFraction =
    peerMedian === null || peerMedian <= 0 || selectedMean === null
      ? null
      : clamp((peerMedian - selectedMean) / peerMedian, 0, 1);

  const docks = baseline.assets.filter(
    (asset) =>
      asset.assetType === "loading_dock" && asset.dwellFirst !== null && asset.dwellLast !== null,
  );
  const increases = docks.map((dock) =>
    Math.max(0, (dock.dwellLast as number) - (dock.dwellFirst as number)),
  );
  const meanIncrease =
    increases.length === 0
      ? null
      : increases.reduce((sum, value) => sum + value, 0) / increases.length;
  const dwellReduction =
    assetType === "forklift" && meanIncrease !== null && idleFraction !== null
      ? meanIncrease * idleFraction
      : null;

  const observed = observedBlock(baseline);
  const projectedThroughput = {
    perDay: { ...observed.throughputOrdersPerDay },
    perHour: { ...observed.throughputOrdersPerHour },
    cost: { ...observed.operatingCost },
  };

  let savings = unavailableFigure("USD", "missing_inputs", "modeled");
  if (parameters.modeledCostPerDwellMinute != null && dwellReduction !== null) {
    const period = dwellReduction * parameters.modeledCostPerDwellMinute * baseline.periodDays;
    savings = changeMonthly(period, 0, baseline.periodDays);
  } else if (assetType !== "forklift") {
    savings = unavailableFigure("USD", "missing_inputs", "modeled");
  }

  const highlights: ScenarioHighlight[] = [
    {
      label: "Selected mean utilization",
      figure:
        selectedMean === null
          ? unavailableFigure("percent", "empty_period", "observed")
          : figure(round4(selectedMean), "percent", "observed"),
    },
    {
      label: "Peer median utilization",
      figure:
        peerMedian === null
          ? unavailableFigure("percent", "missing_inputs", "observed")
          : figure(round4(peerMedian), "percent", "observed"),
    },
    {
      label: "Projected utilization",
      figure:
        peerMedian === null
          ? unavailableFigure("percent", "missing_inputs", "modeled")
          : figure(round4(peerMedian), "percent", "modeled"),
    },
    {
      label: "Modeled dwell reduction",
      figure:
        dwellReduction === null
          ? unavailableFigure(
              "minutes",
              assetType === "forklift" ? "missing_inputs" : "missing_inputs",
              "modeled",
            )
          : figure(round4(dwellReduction), "minutes/day", "modeled"),
    },
  ];

  const costFigure = projectedThroughput.cost;
  const monthly = savings;
  const roi = unavailableFigure("ratio", "missing_inputs", "modeled");

  return {
    kind: "reassign_equipment",
    periodFrom: baseline.periodFrom,
    periodTo: baseline.periodTo,
    baseline: { ...observed, highlights: [] },
    projected: {
      basis: "modeled",
      throughputOrdersPerDay: projectedThroughput.perDay,
      throughputOrdersPerHour: projectedThroughput.perHour,
      operatingCost: costFigure,
      costPerOrder: costPerOrderFigure(costFigure.value, projectedThroughput.perDay, baseline),
      highlights,
    },
    monthlySavings: monthly,
    roi,
    assumptions: [
      "Selected assets are projected at the median utilization of unselected peers of the same type.",
      "Facility orders and operating cost stay at the observed totals. Reassignment does not add orders.",
      assetType === "forklift"
        ? "Dock dwell reduction equals the mean first-to-last dwell increase times the share of peer utilization the selected forklifts are missing."
        : "Dwell is only adjusted for forklifts, because dock time is the stored series that forklifts can affect.",
      parameters.modeledCostPerDwellMinute == null
        ? "No cost per dwell minute was entered. The ledger has no dwell price, so savings are not calculated."
        : "The cost per dwell minute is a modeled assumption.",
      parameters.destinationAreaId
        ? "The destination area is recorded as intent. It does not change the peer-utilization formula."
        : "No destination area was selected.",
    ],
    limitations: [
      peers.length === 0 ? "No peer with stored utilization was found." : "",
      "ROI is unavailable because reassignment has no stored investment.",
      "Dwell savings, when entered, use one facility-level reduction and are not multiplied by the number of docks.",
    ].filter(Boolean),
  };
}

export function projectReduceDowntime(
  baseline: ScenarioBaseline,
  parameters: {
    assetId: string;
    targetDowntimeMinutesPerDay: number;
    modeledRepairCost?: number | null;
  },
): ScenarioProjection {
  const asset = baseline.assets.find((item) => item.assetId === parameters.assetId);
  if (!asset || asset.downtimePerDay === null) {
    return blocked(
      baseline,
      "reduce_downtime",
      [
        asset
          ? `${asset.name} has no downtime samples in the period.`
          : "That asset has no stored samples in the period.",
      ],
      ["Recovered minutes are the gap between observed downtime per day and the target."],
    );
  }

  const recoveredPerDay = Math.max(
    0,
    asset.downtimePerDay - parameters.targetDowntimeMinutesPerDay,
  );
  const facilityDowntimePerDay = divideRaw(baseline.downtimeMinutes, baseline.downtimeDays);
  const productiveHours = productiveHourTotal(baseline);
  const ordersPerProductiveHour = divideRaw(baseline.orders, productiveHours.value);
  let extraOrdersPerDay: number | null = null;
  let extraReason: "missing_inputs" | "zero_denominator" | "empty_period" = "missing_inputs";
  if (recoveredPerDay === 0) {
    extraOrdersPerDay = 0;
  } else if (facilityDowntimePerDay.reason) {
    extraReason = facilityDowntimePerDay.reason;
  } else if ((facilityDowntimePerDay.value as number) <= 0) {
    extraReason = "zero_denominator";
  } else if (productiveHours.reason || ordersPerProductiveHour.reason) {
    extraReason = productiveHours.reason ?? ordersPerProductiveHour.reason ?? "missing_inputs";
  } else {
    const capped = Math.min(recoveredPerDay, facilityDowntimePerDay.value as number);
    extraOrdersPerDay = ((ordersPerProductiveHour.value as number) * capped) / 60;
  }

  const peers = baseline.assets.filter(
    (item) =>
      item.assetId !== asset.assetId &&
      item.assetType === asset.assetType &&
      item.maintenanceCost !== null &&
      item.maintenanceDays,
  );
  const peerDaily = median(
    peers.map((item) => (item.maintenanceCost as number) / (item.maintenanceDays as number)),
  );
  const canShiftMaintenance = recoveredPerDay > 0 && peerDaily !== null && asset.maintenanceDays;
  const projectedMaintenance = canShiftMaintenance
    ? (peerDaily as number) * (asset.maintenanceDays as number)
    : asset.maintenanceCost;
  const projectedCost =
    asset.maintenanceCost === null ||
    projectedMaintenance === null ||
    baseline.operatingCost === null
      ? baseline.operatingCost
      : baseline.operatingCost - asset.maintenanceCost + projectedMaintenance;

  const throughput = projectThroughput(baseline, extraOrdersPerDay, extraReason);
  const resolvedCost =
    projectedCost === null
      ? unavailableFigure(
          "USD",
          baseline.operatingCost === null ? "empty_period" : "missing_inputs",
          "modeled",
        )
      : figure(roundMoney(projectedCost), "USD", canShiftMaintenance ? "modeled" : "observed");

  return assemble(
    baseline,
    "reduce_downtime",
    throughput,
    null,
    [
      {
        label: `${asset.name} downtime per day`,
        figure: figure(round4(asset.downtimePerDay), "minutes/day", "observed"),
      },
      {
        label: "Recovered downtime per day",
        figure: figure(round4(recoveredPerDay), "minutes/day", "modeled"),
      },
      {
        label: "Projected asset maintenance",
        figure:
          projectedMaintenance === null
            ? unavailableFigure("USD", "empty_period", "modeled")
            : figure(
                roundMoney(projectedMaintenance),
                "USD",
                canShiftMaintenance ? "modeled" : "observed",
              ),
      },
    ],
    {
      investment: parameters.modeledRepairCost ?? null,
      costAlreadyResolved: true,
      resolvedCost,
      assumptions: [
        "Recovered minutes per day are observed downtime per day minus the target, and never below zero.",
        "Extra orders use observed orders per productive hour. Productive hours are operating hours minus facility downtime.",
        "Recovered downtime cannot exceed facility downtime per day.",
        canShiftMaintenance
          ? "Projected maintenance is the median daily maintenance of the other assets of the same type, times this asset's sample count. That is a model of returning to the peer cost, not a quote."
          : "Maintenance stays at the observed amount because downtime did not fall or no peer maintenance was stored.",
      ],
      limitations: [
        "The downtime-to-orders link assumes lost minutes would have run at the productive rate.",
        parameters.modeledRepairCost == null
          ? "No repair cost was entered, so ROI is unavailable."
          : "ROI divides modeled monthly maintenance savings by the entered repair cost.",
      ],
    },
  );
}

type HoursOptions = {
  assumptions: string[];
  limitations: string[];
  highlights: ScenarioHighlight[];
  investmentFromExtraLabor: boolean;
  laborRateOverride?: number | null;
};

function projectAddedHours(
  baseline: ScenarioBaseline,
  additionalHoursPerDay: number,
  kind: ScenarioProjection["kind"],
  options: HoursOptions,
): ScenarioProjection {
  if (!(additionalHoursPerDay > 0)) {
    return blocked(
      baseline,
      kind,
      ["Additional hours must be greater than zero."],
      options.assumptions,
    );
  }
  const perHour = divideRaw(baseline.orders, baseline.operatingHours);
  const hoursPerDay = divideRaw(baseline.operatingHours, baseline.hourDays);
  const laborPerHour =
    options.laborRateOverride !== undefined
      ? {
          value: options.laborRateOverride,
          reason: options.laborRateOverride === null ? ("missing_inputs" as const) : null,
        }
      : divideRaw(baseline.laborCost, baseline.operatingHours);

  let extraOrdersPerDay: number | null = null;
  let extraReason: ScenarioFigure["unavailableReason"] = perHour.reason ?? hoursPerDay.reason;
  if (!perHour.reason && !hoursPerDay.reason) {
    extraOrdersPerDay = (perHour.value as number) * additionalHoursPerDay;
    extraReason = null;
  }

  const throughput = projectThroughput(
    baseline,
    extraOrdersPerDay,
    extraReason ?? "missing_inputs",
  );
  let projectedCost = throughput.cost;
  let extraLaborPeriod: number | null = null;
  if (baseline.operatingCost === null || baseline.laborCost === null) {
    projectedCost = unavailableFigure(
      "USD",
      baseline.operatingCost === null ? "empty_period" : "missing_inputs",
      "modeled",
    );
  } else if (laborPerHour.reason || laborPerHour.value === null) {
    projectedCost = unavailableFigure("USD", laborPerHour.reason ?? "missing_inputs", "modeled");
  } else {
    extraLaborPeriod = (laborPerHour.value as number) * additionalHoursPerDay * baseline.periodDays;
    projectedCost = figure(roundMoney(baseline.operatingCost + extraLaborPeriod), "USD", "modeled");
  }

  const highlights = [
    ...options.highlights,
    {
      label: "Additional hours per day",
      figure: figure(round4(additionalHoursPerDay), "hours/day", "modeled"),
    },
    {
      label: "Extra labor in the period",
      figure:
        extraLaborPeriod === null
          ? unavailableFigure("USD", laborPerHour.reason ?? "missing_inputs", "modeled")
          : figure(roundMoney(extraLaborPeriod), "USD", "modeled"),
    },
  ];

  const investment = !options.investmentFromExtraLabor
    ? null
    : extraLaborPeriod === null || baseline.periodDays <= 0
      ? null
      : (extraLaborPeriod * MONTH_DAYS) / baseline.periodDays;
  const investmentMissing = extraLaborPeriod === null || baseline.periodDays <= 0;

  return assemble(baseline, kind, throughput, null, highlights, {
    investment: investmentMissing ? null : investment,
    zeroInvestmentReason: extraLaborPeriod === 0 ? "zero_denominator" : null,
    costAlreadyResolved: true,
    resolvedCost: projectedCost,
    assumptions: options.assumptions,
    limitations: options.limitations,
  });
}

function assemble(
  baseline: ScenarioBaseline,
  kind: ScenarioProjection["kind"],
  throughput: {
    perDay: ScenarioFigure;
    perHour: ScenarioFigure;
    cost: ScenarioFigure;
  },
  projectedCostValue: number | null,
  highlights: ScenarioHighlight[],
  options: {
    investment: number | null;
    assumptions: string[];
    limitations: string[];
    costAlreadyResolved?: boolean;
    resolvedCost?: ScenarioFigure;
    zeroInvestmentReason?: "zero_denominator" | null;
  },
): ScenarioProjection {
  const observed = observedBlock(baseline);
  const costFigure = options.costAlreadyResolved
    ? (options.resolvedCost as ScenarioFigure)
    : projectedCostValue === null
      ? unavailableFigure(
          "USD",
          baseline.operatingCost === null ? "empty_period" : "missing_inputs",
          "modeled",
        )
      : figure(roundMoney(projectedCostValue), "USD", "modeled");
  const projectedPerDay = throughput.perDay;
  const block: PerformanceBlock = {
    basis: "modeled",
    throughputOrdersPerDay: projectedPerDay,
    throughputOrdersPerHour: throughput.perHour,
    operatingCost: costFigure,
    costPerOrder: costPerOrderFigure(costFigure.value, projectedPerDay, baseline),
    highlights,
  };
  const monthly =
    options.costAlreadyResolved && costFigure.value === null
      ? unavailableFigure("USD", costFigure.unavailableReason ?? "missing_inputs", "modeled")
      : changeMonthly(
          baseline.operatingCost,
          costFigure.basis === "observed" ? null : costFigure.value,
          baseline.periodDays,
        );
  const savings =
    costFigure.basis === "observed" && !options.costAlreadyResolved
      ? unavailableFigure("USD", "missing_inputs", "modeled")
      : monthly;
  const resolvedSavings = options.costAlreadyResolved
    ? changeMonthly(baseline.operatingCost, costFigure.value, baseline.periodDays)
    : savings;
  const finalSavings =
    costFigure.basis === "observed"
      ? unavailableFigure("USD", "missing_inputs", "modeled")
      : resolvedSavings;

  let roi: ScenarioFigure;
  if (options.zeroInvestmentReason === "zero_denominator") {
    roi = unavailableFigure("ratio", "zero_denominator", "modeled");
  } else if (options.investment === null || finalSavings.value === null) {
    roi = unavailableFigure("ratio", "missing_inputs", "modeled");
  } else if (options.investment === 0) {
    roi = unavailableFigure("ratio", "zero_denominator", "modeled");
  } else if (options.investment < 0) {
    roi = unavailableFigure("ratio", "missing_inputs", "modeled");
  } else {
    roi = figure(round4(finalSavings.value / options.investment), "ratio", "modeled");
  }

  return {
    kind,
    periodFrom: baseline.periodFrom,
    periodTo: baseline.periodTo,
    baseline: observed,
    projected: block,
    monthlySavings: finalSavings,
    roi,
    assumptions: options.assumptions,
    limitations: options.limitations,
  };
}

function blocked(
  baseline: ScenarioBaseline,
  kind: ScenarioProjection["kind"],
  limitations: string[],
  assumptions: string[],
): ScenarioProjection {
  const observed = observedBlock(baseline);
  const missing = (unit: string): ScenarioFigure =>
    unavailableFigure(unit, "missing_inputs", "modeled");
  return {
    kind,
    periodFrom: baseline.periodFrom,
    periodTo: baseline.periodTo,
    baseline: observed,
    projected: {
      basis: "modeled",
      throughputOrdersPerDay: missing("orders/day"),
      throughputOrdersPerHour: missing("orders/hour"),
      operatingCost: missing("USD"),
      costPerOrder: missing("USD/order"),
      highlights: [],
    },
    monthlySavings: missing("USD"),
    roi: missing("ratio"),
    assumptions,
    limitations,
  };
}

function observedBlock(baseline: ScenarioBaseline): PerformanceBlock {
  const perDay =
    baseline.orders === null
      ? unavailableFigure("orders/day", "empty_period", "observed")
      : tag(
          throughputOrdersPerDay({ orders: baseline.orders, days: baseline.orderDays }),
          "observed",
        );
  const perHour =
    baseline.orders === null || baseline.operatingHours === null
      ? unavailableFigure(
          "orders/hour",
          baseline.orders === null ? "empty_period" : "empty_period",
          "observed",
        )
      : tag(
          throughputOrdersPerHour({ orders: baseline.orders, hours: baseline.operatingHours }),
          "observed",
        );
  const cost =
    baseline.operatingCost === null
      ? unavailableFigure("USD", "empty_period", "observed")
      : figure(roundMoney(baseline.operatingCost), "USD", "observed");
  return {
    basis: "observed",
    throughputOrdersPerDay: perDay,
    throughputOrdersPerHour: perHour,
    operatingCost: cost,
    costPerOrder:
      baseline.operatingCost === null || baseline.orders === null
        ? unavailableFigure(
            "USD/order",
            baseline.orders === null ? "empty_period" : "empty_period",
            "observed",
          )
        : tag(
            costPerOrder({ operatingCost: baseline.operatingCost, orders: baseline.orders }),
            "observed",
          ),
    highlights: [],
  };
}

function projectThroughput(
  baseline: ScenarioBaseline,
  extraPerDay: number | null,
  reason: NonNullable<ScenarioFigure["unavailableReason"]>,
) {
  const observed = observedBlock(baseline);
  const perDay =
    extraPerDay === null || observed.throughputOrdersPerDay.value === null
      ? unavailableFigure(
          "orders/day",
          observed.throughputOrdersPerDay.value === null
            ? (observed.throughputOrdersPerDay.unavailableReason ?? "empty_period")
            : reason,
          "modeled",
        )
      : figure(
          round4(observed.throughputOrdersPerDay.value + extraPerDay),
          "orders/day",
          "modeled",
        );
  const hoursPerDay = divideRaw(baseline.operatingHours, baseline.hourDays);
  const perHour =
    perDay.value === null
      ? unavailableFigure("orders/hour", perDay.unavailableReason ?? "missing_inputs", "modeled")
      : hoursPerDay.reason
        ? unavailableFigure("orders/hour", hoursPerDay.reason, "modeled")
        : figure(round4(perDay.value / (hoursPerDay.value as number)), "orders/hour", "modeled");
  return { perDay, perHour, cost: observed.operatingCost };
}

function costPerOrderFigure(
  cost: number | null,
  perDay: ScenarioFigure,
  baseline: ScenarioBaseline,
): ScenarioFigure {
  if (cost === null || perDay.value === null || baseline.orderDays === null) {
    return unavailableFigure(
      "USD/order",
      cost === null || baseline.orders === null
        ? "empty_period"
        : (perDay.unavailableReason ?? "missing_inputs"),
      perDay.basis,
    );
  }
  const orders = perDay.value * baseline.orderDays;
  if (orders === 0) return unavailableFigure("USD/order", "zero_denominator", perDay.basis);
  return figure(
    roundMoney(cost / orders),
    "USD/order",
    perDay.basis === "observed" ? "observed" : "modeled",
  );
}

function changeMonthly(
  baselineCost: number | null,
  projectedCost: number | null,
  periodDays: number,
): ScenarioFigure {
  if (baselineCost === null || projectedCost === null) {
    return unavailableFigure("USD", "missing_inputs", "modeled");
  }
  if (!Number.isFinite(periodDays) || periodDays < 0) {
    return unavailableFigure("USD", "missing_inputs", "modeled");
  }
  if (periodDays === 0) return unavailableFigure("USD", "zero_denominator", "modeled");
  return figure(
    roundMoney(((baselineCost - projectedCost) * MONTH_DAYS) / periodDays),
    "USD",
    "modeled",
  );
}

function addCost(operatingCost: number | null, incremental: number | null) {
  if (operatingCost === null || incremental === null) return null;
  return operatingCost + incremental;
}

function monthlyToPeriod(monthly: number | null, periodDays: number) {
  if (monthly === null || !Number.isFinite(periodDays) || periodDays <= 0) return null;
  return (monthly * periodDays) / MONTH_DAYS;
}

function scaleOrdersPerDay(baseline: ScenarioBaseline, gain: number | null) {
  if (
    gain === null ||
    baseline.orders === null ||
    baseline.orderDays === null ||
    baseline.orderDays === 0
  ) {
    return null;
  }
  return (baseline.orders / baseline.orderDays) * gain;
}

function productiveHourTotal(baseline: ScenarioBaseline) {
  if (baseline.operatingHours === null || baseline.downtimeMinutes === null) {
    return { value: null, reason: "empty_period" as const };
  }
  const hours = baseline.operatingHours - baseline.downtimeMinutes / 60;
  if (hours === 0) return { value: 0, reason: "zero_denominator" as const };
  if (hours < 0) return { value: null, reason: "missing_inputs" as const };
  return { value: hours, reason: null };
}

function divideRaw(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null)
    return { value: null, reason: "empty_period" as const };
  if (denominator === 0) return { value: null, reason: "zero_denominator" as const };
  if (denominator < 0 || numerator < 0) return { value: null, reason: "missing_inputs" as const };
  return { value: numerator / denominator, reason: null };
}

function pickReference(stations: ScenarioAsset[], assetId?: string | null) {
  if (assetId) return stations.find((asset) => asset.assetId === assetId) ?? null;
  const ranked = stations.filter((asset) => asset.utilization !== null);
  ranked.sort((a, b) => (b.utilization as number) - (a.utilization as number));
  return ranked[0] ?? stations[0] ?? null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return sorted[mid] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tag(
  value: {
    value: number | null;
    unit: string;
    unavailableReason: ScenarioFigure["unavailableReason"];
  },
  basis: ScenarioFigure["basis"],
): ScenarioFigure {
  return {
    value: value.value === null ? null : round4(value.value),
    unit: value.unit,
    unavailableReason: value.unavailableReason,
    basis,
  };
}

function copyFigure(value: ScenarioFigure): ScenarioFigure {
  return { ...value };
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

# FacilityIQ scenario projections

Projections are deterministic TypeScript in `src/lib/scenarios`. They read the same stored samples as the dashboard. An LLM is never used to compute throughput, cost, savings, or ROI.

Every projected dollar is a **modeled estimate**, not a verified saving. The UI and API label baseline blocks as `observed` and projected blocks as `modeled`.

## Period

Runs use the selected `from` / `to` day range (default: latest stored sample and the 29 days before it). Missing series stay null. Stored zeros stay zero.

## Shared outputs

| Field                       | Source                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Baseline throughput / cost  | Observed facility totals in the period                                                    |
| Projected throughput / cost | Baseline plus the rule for that scenario kind                                             |
| Estimated monthly savings   | `(baselineCost − projectedCost) × 30 / periodDays` when both costs are available          |
| Estimated ROI               | Monthly savings ÷ entered investment (or extra monthly labor for hour/staffing scenarios) |
| Assumptions / limitations   | Returned with every projection                                                            |

Unavailable reasons match the KPI library: `empty_period`, `missing_inputs`, `zero_denominator`.

## Scenario kinds

### Add a packing station (`add_packing_station`)

- Recovered orders/day = max(0, peer median orders/day − reference station orders/day), capped at peer median × additional stations.
- Station-level orders are not already in the facility total, so recovered orders are added to facility throughput.
- Optional modeled monthly cost per station and investment drive cost and ROI. Without them, cost stays observed and savings stay unavailable.

### Increase conveyor capacity (`increase_conveyor_capacity`)

- Gain fraction = `(capacityIncreasePercent / 100) × (asset utilization / 100)`.
- Extra orders/day = observed facility orders/day × gain.
- Optional modeled monthly cost / investment. Without cost, savings are not claimed.

### Extend operating hours (`extend_operating_hours`)

- Extra orders/day = observed orders/hour × additional hours/day.
- Extra labor = observed labor $/hour × additional hours/day × period days.
- Projected operating cost = observed operating cost + extra labor.
- ROI denominator is the extra monthly labor.

### Reassign equipment (`reassign_equipment`)

- Selected assets of one type are projected at the median utilization of unselected peers.
- Facility orders and operating cost stay observed.
- For forklifts, dwell reduction = mean first-to-last dock dwell increase × idle fraction versus peer utilization.
- Savings require an entered cost per dwell minute.

### Increase staffing (`increase_staffing`)

- Additional hours/day = headcount × hours per person (entered, or facility hours/day).
- Same order and labor scaling as extend hours.
- Labor rate defaults to observed labor ÷ operating hours unless overridden.

### Reduce equipment downtime (`reduce_downtime`)

- Recovered minutes/day = max(0, asset downtime/day − target).
- Extra orders use observed orders per productive hour; recovered minutes are capped by facility downtime/day.
- Maintenance may shift to the median daily peer cost of the same asset type when downtime falls.
- Optional repair cost is the ROI denominator.

## APIs

- `GET /api/scenarios` — list for the current facility
- `POST /api/scenarios` — create (`scenarios:write`)
- `GET /api/scenarios/[id]` — detail + stored results
- `PUT /api/scenarios/[id]` — update
- `DELETE /api/scenarios/[id]` — delete
- `POST /api/scenarios/[id]?action=duplicate` — copy as draft
- `POST /api/scenarios/[id]/run?from=&to=` — compute and persist a result
- `GET /api/scenarios/compare?left=&right=&from=&to=` — one vs baseline when `right` is omitted

Permissions: org admins and operations managers write; finance managers review/read; viewers read only.

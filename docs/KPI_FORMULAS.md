# FacilityIQ KPI formulas

These formulas live in `src/lib/analytics/kpis.ts` and are applied to stored rows by `src/lib/analytics/aggregate.ts`.

A result is either a measured `value` or `value: null` with `unavailableReason`:

| Reason             | Meaning                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `missing_inputs`   | A required input is null, undefined, not finite, or negative. Checked before a zero denominator. |
| `zero_denominator` | The denominator is exactly zero. Do not render this as `0`.                                      |
| `empty_period`     | The period has no usable observations. Do not render this as `0`.                                |

A numerator of zero with a positive denominator is a real zero.

Currency is USD. Timestamps are UTC. The bottleneck warning threshold is **0.70** on a 0–1 severity scale (`BOTTLENECK_WARNING_THRESHOLD`).

## Throughput (orders/hour)

- **Formula:** orders in period / hours in period
- **Numerator:** sum of `orders_processed`
- **Denominator:** sum of `operating_hours`, or the clock hours the facility was open
- **Unit:** `orders/hour`
- **Aggregation:** sum, then divide. Do not average daily rates unless every day has the same hours.
- **Zero denominator:** `unavailableReason = zero_denominator`
- **Missing orders or hours:** `missing_inputs`

## Throughput (orders/day)

- **Formula:** orders in period / days in period
- **Numerator:** sum of `orders_processed`
- **Denominator:** number of days in the selected period that are in scope. A day with a stored zero is still a day.
- **Unit:** `orders/day`
- **Zero denominator:** no days in the period
- **Missing inputs:** orders or day count missing

## Utilization percent

- **Formula:** busy time / available time × 100
- **Numerator:** `busy_minutes` (or equivalent busy time)
- **Denominator:** `available_minutes`
- **Unit:** `percent`
- **Zero denominator:** available time is 0
- **Stored samples:** `utilizationFromSamples` averages finite `utilization` samples that are already in percent. Null samples are ignored. If none remain, the reason is `empty_period`, not 0%.

Seeded equipment stores both the percent and, for forklifts and packing stations, busy and available minutes that match that percent for the day's operating hours (16 weekday, 8 weekend).

## Cost per order

- **Formula:** operating cost in period / orders in period
- **Numerator:** sum of `financial_metrics.amount` for the operating categories in scope (labor, maintenance, energy, equipment, overhead)
- **Denominator:** orders in the same period
- **Unit:** `currency/order`
- **Zero denominator:** orders are 0
- **Aggregation:** sum money in the database, then divide. Do not average daily cost-per-order figures.

Facility-level maintenance in the seed is building overhead only. Conveyor maintenance is stored on the asset. Include each scope once.

## Average cycle time

- **Formula:** mean of `cycle_time_minutes` samples in the period
- **Unit:** `minutes`
- **Aggregation:** arithmetic mean of finite samples ≥ 0. Nulls are dropped.
- **Empty period:** no usable samples

## Bottleneck count

- **Formula:** count of distinct asset or area ids whose bottleneck severity is **strictly greater** than 0.70 in the period
- **Unit:** `count`
- **Aggregation:** distinct ids. Repeated samples for the same id count once.
- **Empty period:** the observation list is empty
- **Measured zero:** observations exist and none exceed the threshold
- **Non-finite severity:** ignored, not treated as a bottleneck

## Phase 3 aggregation rules

- Facility throughput, units, cycle time, and facility downtime use rows where both `area_id` and `asset_id` are null. Asset-level orders are not added on top of the facility total.
- A metric with no stored rows is null. It is not coerced to 0. `units_processed`, downtime, and category costs use `empty_period` when that series is absent. Throughput and cost per order use `missing_inputs` when orders or hours are absent, and `zero_denominator` when the stored denominator is 0.
- Days in the orders-per-day denominator are distinct dates that have a facility `orders_processed` row. A stored zero still counts. A calendar day with no row is outside the denominator.
- Asset utilization is the mean of `utilization` samples with an `asset_id`. Area utilization uses samples with an `area_id` and no `asset_id`.
- Capacity utilization is packing-station `busy_minutes` / `available_minutes`. If either series is missing, the result is unavailable.
- Bottleneck count uses the maximum `bottleneck_severity` sample per asset or area. The mean severity KPI averages every stored severity sample.
- Operating cost is the sum of every `financial_metrics` row in the window. Facility maintenance in the seed is building overhead only; conveyor maintenance is stored on the asset and is included once. A cost category, area, or asset with no rows is omitted, not shown as 0. Rows with no area are labeled Facility-wide.
- The previous period is the immediately preceding window of the same number of inclusive days. If either side is unavailable, the delta is null.
- The default range is the latest stored sample date and the 29 days before it. Date controls change this range.
- Heatmap utilization uses the thresholds above. Bottleneck severity uses green at or below 0.40, amber through 0.70, and red above 0.70. Throughput and operating cost are split across the observed min and max; a missing sample is not colored. Equal observed values stay amber rather than being treated as zero.

## What an LLM must not do

Financial and operational KPIs are never computed by a model. `DeterministicRulesProvider` reads the same stored samples as the dashboard. An optional language model, used only when `AI_API_KEY` is set, may rephrase title, description, and recommended action. Zod rejects any extra field, including a financial estimate. Estimated savings are labeled `estimate` in `evidence.impactLabel`. A null impact is `not_calculable`. Neither is a verified saving.

## Phase 4 insight rules

Rules run on the selected facility and period. They do not copy the planning dollars stored on the original seed rows.

- Excessive aisle utilization: mean area `utilization` (area set, asset empty) above 90%. Impact is not calculable.
- Packing-station capacity shortfall: mean utilization at least 95% and either orders per day below the peer median or maximum bottleneck severity above 0.70. Impact is not calculable.
- Underutilized forklifts: mean utilization under 25%. One insight lists every matching forklift. Impact is not calculable.
- Increasing dock dwell: last `dwell_time_minutes` sample is at least 20 minutes above the first. One insight lists every matching dock. No cost per minute is stored, so impact is not calculable.
- Rising conveyor maintenance: last asset maintenance sample is at least 1.5 times the first, and the first is positive. The estimate is the sum of stored amounts minus the first amount held flat for the same number of samples. Facility-level maintenance is excluded.
- A stable area (mean utilization from 45% through 75%, at least 10 samples, and not already excessive) is included so healthy areas stay visible.

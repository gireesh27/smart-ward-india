# Development score, metrics and insight rules

All dashboard figures are calculated from stored records. Nothing is hard-coded from the reference images; numbers you see after seeding come from the synthetic data.

## Indicators

| Key | Name | Measured as | Weight |
|---|---|---|---|
| `drinking_water` | Drinking Water | % households with regular piped water supply | 20 % |
| `roads` | Roads | % road length in good condition | 15 % |
| `drainage` | Drainage | % households connected to drains | 15 % |
| `sanitation` | Sanitation | % households with door-to-door waste collection | 15 % |
| `healthcare` | Healthcare | % population within 2 km of a health centre | 10 % |
| `education` | Education | % schools meeting basic infrastructure norms (UDISE+) | 10 % |
| `employment` | Employment | % households seeking work that received it (MGNREGA / urban schemes) | 10 % |
| `electricity` | Electricity | % streetlights working | 5 % |

These are the company profile's proposed initial weights (total 100 %); they still need validation with development experts. Targets are 100 and worst values 0 for every indicator by default. The public **Features** page shows the live weights from the database.

Weights, targets, “worst” values and active flags are editable by super administrators (**Settings → Scoring**). Saving recomputes every snapshot and is audited. Indicators can be “lower is better” by setting target below worst.

**Calculation period:** calendar month (UTC). One reading per ward × indicator × month (`IndicatorReading`, unique). Administrators record or correct readings under **Ward Analytics → Record an indicator reading**; the affected ward-month is rescored immediately.

## Formula

1. Normalise each available value linearly: `n = clamp(100 × (value − worst) / (target − worst), 0, 100)`.
2. Score = `Σ(nᵢ × wᵢ) / Σ(wᵢ for indicators with data)`, rounded to 0.1.
3. Contribution (points) of indicator *i* = `nᵢ × wᵢ / Σ(wᵢ with data)`; contributions sum to the score.

**Missing data:** coverage = `Σ(weights with data) / Σ(all active weights)`. If coverage is below the minimum (default **0.6**, configurable), the score is **null** and the UI shows “insufficient data” — the platform never estimates. Snapshots (`ScoreSnapshot`) store score, coverage and the per-indicator breakdown for history.

**Aggregates:** a district or filtered selection uses the mean of available ward scores for the period. Dashboards use the most recent period with data within the last three months and label it (“Scores use indicator data for October 2026”).

**Bands:** ≥ 90 Excellent · ≥ 80 Good · ≥ 70 Needs Attention · < 70 Critical.

## Other metrics

| Metric | Definition |
|---|---|
| Reported | Complaints created in the selected month. |
| Resolved | Complaints whose `resolvedAt` falls in the selected month. |
| Resolution rate | Resolved ÷ Reported × 100 for the month, capped at 100 (throughput measure). |
| Citizen satisfaction | Mean feedback rating in the month × 20 (0–100). |
| Change vs last month | Counts: relative % change; scores/rates: absolute change in points. Shown as “No comparison data” when the previous value is missing or zero. |
| Overdue | Open complaint whose `dueAt` has passed. `dueAt = createdAt + category SLA × priority factor` (Low 1.5, Medium 1, High 0.75, Urgent 0.5). |
| Total wards change | Active wards existing at the end of the month vs end of the previous month. |

## Rule-based insights

Deterministic rules in `src/lib/domain/insights.ts`, evaluated per ward × category. They are **not** trained forecasts and make no accuracy claims.

| Rule | Fires when (defaults) | Severity |
|---|---|---|
| Water supply risk | ≥ 4 new water complaints in 30 days **and** ≥ 1.5 × the previous 30 days, **or** ≥ 10 unresolved | High if doubled or ≥ 10 open, else Medium |
| Road repair priority | ≥ 3 open road complaints past their deadline | High if ≥ 6 |
| Drainage review | ≥ 6 drainage complaints in 90 days | High if ≥ 10 |
| Service backlog | other categories: ≥ 4 open and ≥ 50 % overdue | Medium |

Each insight stores affected ward, evidence numbers, severity, generation time, a suggested action, and a link to the filtered complaint list. Insights refresh at most hourly when a dashboard opens, on demand (**Insights → Run rules now**), or via `npm run insights:refresh`. Insights whose condition stops holding close automatically; dismissed ones stay dismissed.

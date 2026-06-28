# BP-004 – Forecast Lifecycle

## Purpose
Describe how forecasts are created, maintained and used throughout Bałtyckie OS.

## Process
1. Create initial forecast when a contract starts.
2. Generate revenue forecast.
3. Generate contractual cost forecast.
4. Estimate variable costs from historical data when required.
5. Aggregate apartment forecasts into company forecasts.
6. Compare Actual against Forecast.
7. Analyse variances.
8. Update forecasts after contract changes or major business events.
9. Preserve historical forecast versions for comparison.

## Business Rules
- Forecast always precedes Actual.
- Forecast is the reference for KPIs and dashboards.
- Contract changes trigger forecast recalculation.
- Company forecast is the sum of apartment forecasts plus company-level items.
- Forecasts support decisions, not accounting.

## Related
PROJECT_HANDOVER.md
ADR-001
Business_Principles.md
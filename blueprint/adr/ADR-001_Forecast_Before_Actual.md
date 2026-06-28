# ADR-001 – Forecast Before Actual

**Status:** Accepted
**Date:** 2026-06-28
**Owner:** Mateusz Cieślak

## Context
Bałtyckie OS is a decision-support system, not a historical reporting tool. The owner manages the future of the business, therefore every important screen should begin with what was planned before showing what actually happened.

## Decision
Throughout the entire application the presentation order is always:

1. Forecast
2. Actual
3. Variance
4. Explanation
5. Recommended action

This rule applies to dashboards, Apartment Center, Partner Center, Forecast Center, Payment Center, reports, KPI cards, tables and charts.

## Rationale
- Decisions are based on future expectations.
- Deviations are immediately visible.
- Financial planning becomes consistent.
- All modules share one reporting philosophy.

## Consequences
### Positive
- Consistent UX.
- Easier business analysis.
- Better AI explanations based on deviations.
- Comparable reports across the system.

### Negative
- Users familiar with traditional reports may need time to adapt.

## Exceptions
No exceptions are allowed unless approved through a new ADR.

## Implementation Rules
- Forecast columns always appear before Actual columns.
- Charts use Forecast as the reference series.
- AI analyses compare Actual against Forecast.
- Any new module must follow this rule.

## Related Documents
- PROJECT_HANDOVER.md
- AI.md
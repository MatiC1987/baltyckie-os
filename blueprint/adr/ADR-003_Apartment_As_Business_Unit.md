# ADR-003 – Apartment as Business Unit

Status: Accepted
Date: 2026-06-28

## Context
In Bałtyckie OS an apartment is not only a property record. It is the primary business unit used to evaluate profitability, forecast performance and manage cooperation with partners.

## Decision
Every apartment is treated as an independent business unit.

It aggregates:
- revenue,
- forecast,
- costs,
- contracts,
- payments,
- documents,
- partner relationship,
- operational history.

## Consequences
- Apartment Center becomes the main operational screen.
- Financial analysis is performed per apartment and then aggregated to company level.
- Every apartment has one complete business history.

## Related
PROJECT_HANDOVER.md
AI.md
ADR-001_Forecast_Before_Actual.md
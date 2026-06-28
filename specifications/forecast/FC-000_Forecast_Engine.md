# FC-000 – Forecast Engine

## Status
Draft

## Business Goal
The Forecast Engine is responsible for creating and maintaining forward-looking financial forecasts for apartments and the company.

## Scope
- Revenue forecasts
- Contract cost forecasts
- Company cash flow forecasts
- Forecast recalculation
- Variance analysis

## Functional Requirements
- Generate forecasts from contracts.
- Recalculate after annexes and contract changes.
- Preserve forecast history.
- Aggregate apartment forecasts to company level.
- Expose forecast data to Dashboard, Apartment Center and Payment Center.

## Business Rules
- Forecast always precedes Actual.
- Historical forecasts are immutable.
- AI may suggest forecast adjustments but never overwrite business rules.

## Related
ADR-001
BP-004_Forecast_Lifecycle.md
BP-008_Company_Cash_Flow.md
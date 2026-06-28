# PC-000 – Payment Center

## Status
Draft

## Business Goal
Payment Center manages all financial obligations resulting from contracts and supports efficient payment execution while maintaining full traceability.

## Scope
- Payment schedule
- Upcoming payments
- Transfer generation
- Payment confirmation
- Settlement history
- Cash flow impact

## Functional Requirements
- Automatically generate payment obligations from contracts.
- Group payments by due date and partner.
- Support batch transfer generation.
- Track payment status.
- Update cash flow and forecasts after settlement.

## Business Rules
- Contracts are the source of payment obligations.
- Every payment is traceable.
- Payment history is immutable.
- Manual corrections require audit history.

## Related
BP-005_Payment_Lifecycle.md
BP-008_Company_Cash_Flow.md
FC-000_Forecast_Engine.md
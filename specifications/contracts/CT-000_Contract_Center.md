# CT-000 – Contract Center

## Status
Draft

## Business Goal
Contract Center is the source of truth for all cooperation agreements, annexes, obligations and contract-driven forecasts.

## Scope
- Contracts
- Annexes
- Contract terms
- Apartment assignments
- Partner assignments
- Payment obligations
- Forecast generation
- Document history

## Functional Requirements
- Add and manage contracts.
- Add annexes without losing original contract history.
- Assign one contract to one or many apartments.
- Generate payment obligations from contract terms.
- Generate cost forecasts from contract terms.
- Link contracts to Partner Center and Apartment Center.
- Preserve full document history.

## Business Rules
- Contract is the source of payment obligations.
- Annex modifies contract logic but never deletes history.
- One Partner may have many contracts.
- One contract may cover many apartments.
- Contract end date does not automatically end forecast unless user explicitly ends cooperation.

## Related
BP-003_Contract_Lifecycle.md
BP-005_Payment_Lifecycle.md
PR-000_Partner_Center.md
FC-000_Forecast_Engine.md
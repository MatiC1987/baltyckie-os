# Architecture Principles

This document defines the long-term architectural rules for Bałtyckie OS.

## Principles

1. Business rules before UI.
2. One source of truth for every business value.
3. Business processes drive modules, not the opposite.
4. Extend existing functionality before creating new modules.
5. Forecast engine is a core domain service.
6. Contracts generate obligations, forecasts and payment schedules.
7. Keep business logic independent from presentation.
8. Prefer modular architecture with clearly defined responsibilities.
9. Every module must support automation where possible.
10. AI explains and recommends; deterministic business rules calculate.

## Design Goals
- Scalability
- Maintainability
- Traceability
- Automation
- Clear business ownership

## Related Documents
- PROJECT_HANDOVER.md
- AI.md
- Business_Principles.md
- ADR documents
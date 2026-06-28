# Development Principles

This document defines how Bałtyckie OS should evolve.

## General Rules
- Improve existing functionality before replacing it.
- Deliver complete vertical slices.
- Keep commits small and focused.
- Every implementation starts from business requirements.
- Every feature should have a related Specification.
- Every important architectural decision should have an ADR.

## Quality Rules
- No duplicated business logic.
- No duplicated editable data.
- Prefer composition over duplication.
- Keep modules loosely coupled.
- Optimise for long-term maintainability.

## Review Checklist
Before marking work complete verify:
1. Business rules are respected.
2. UX is consistent.
3. Documentation is updated.
4. Related ADRs are respected.
5. Code is ready for future automation.
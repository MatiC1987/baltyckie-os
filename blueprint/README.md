# Bałtyckie OS Blueprint

**Status:** Active  
**Version:** 1.0  
**Owner:** Apartamenty Bałtyckie  

## Purpose

This folder is the single source of truth for the Bałtyckie OS product.

No major implementation should be sent to Replit, Codex, Claude Code, or any future developer unless the relevant feature has an approved specification in this Blueprint.

## Core rule

Code follows Blueprint. Blueprint does not follow accidental code.

If an implementation requires a change in product logic, business rules, UX, or data behavior, the Blueprint must be updated first.

## Structure

- `000_Vision.md` – product vision
- `001_Product_Principles.md` – permanent product principles
- `002_Business_Model.md` – business model of Apartamenty Bałtyckie
- `modules/` – specifications for product areas
- `adr/` – architecture decision records
- `backlog/` – roadmap and sprint planning

## Status labels

Each document uses one of the following statuses:

- `Draft` – still being designed
- `Approved` – accepted as product direction
- `Implemented` – implemented in application
- `Deprecated` – no longer valid

## Development rule

Every Replit task should reference the relevant Blueprint document and task ID.
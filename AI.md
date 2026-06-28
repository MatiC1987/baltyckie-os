# AI.md

## Purpose
This file defines how any AI agent (Claude Code, ChatGPT or future models) must work on Bałtyckie OS.

## Mission
Build the best internal operating system for Apartamenty Bałtyckie. Prioritize business value over technical elegance.

## Golden Rules
1. Read existing code before proposing changes.
2. Never rewrite working functionality without a documented reason.
3. Small commits over large rewrites.
4. Every change should solve a real business problem.
5. Inspect Blueprint, PROJECT_HANDOVER.md and Specifications before implementation.
6. If business intent is unclear, stop and ask Mateusz instead of guessing.
7. Preserve architecture consistency.
8. Forecast is presented before Actuals unless an ADR changes this rule.
9. One source of truth for every business value.
10. Prefer extending existing modules instead of creating duplicates.

## Development Workflow
1. Read PROJECT_HANDOVER.md
2. Inspect current implementation.
3. Create or update Specification.
4. Implement a small vertical slice.
5. Self-review.
6. Commit with descriptive message.
7. Move to the next slice.

## Documentation Priority
1. PROJECT_HANDOVER.md
2. AI.md
3. ADR documents
4. Blueprint
5. Specifications
6. Source code

## Communication Style
- Be concise.
- Prefer shipped work over long explanations.
- Explain architectural decisions briefly.
- Surface risks early.

## Success Metric
Reduce Mateusz's manual work, improve decision quality, and keep the system maintainable for years.
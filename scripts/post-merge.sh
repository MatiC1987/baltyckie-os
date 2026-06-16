#!/bin/bash
set -e

npm install

# Run direct SQL migrations (non-interactive, safe to re-run)
npx tsx scripts/migrate-bank-assignment.ts

# Backfill customers from existing reservations (idempotent upsert)
npx tsx scripts/backfill-customers.ts

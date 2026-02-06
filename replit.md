# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Full-stack Polish-language apartment rental financial management application. Manages short-term reservations (Airbnb-style), long-term leases, expenses, bank accounts, and provides financial dashboards. Uses PLN currency throughout.

## Tech Stack
- **Frontend**: React + Vite + TypeScript, Tailwind CSS, shadcn/ui, Recharts, Framer Motion
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon via Replit), Drizzle ORM
- **Auth**: Replit Auth (OIDC)
- **Excel Import**: xlsx library for .xlsx parsing

## Project Structure
```
client/src/
  pages/          - Dashboard, Apartments, Reservations, Leases, Finance, Import, Landing
  components/     - Layout, Sidebar, DataTable, ui/ (shadcn components)
  hooks/          - use-auth, use-apartments, use-reservations, use-leases, use-expenses, use-accounts, use-stats
  lib/            - queryClient (TanStack Query v5)
server/
  routes.ts       - All API endpoints + Excel import logic
  storage.ts      - Database CRUD operations (IStorage interface)
  db.ts           - Drizzle database connection
  replit_integrations/ - Auth setup
shared/
  schema.ts       - Drizzle schema (apartments, reservations, leases, expenses, accounts, accountSnapshots)
  routes.ts       - API contract with Zod schemas
  models/auth.ts  - User model for Replit Auth
```

## Key Features
1. **Dashboard** - Revenue/expense stats, bar chart, recent reservations
2. **Apartments** - CRUD with name, location (6 fixed categories), address, owner, presentation photo, lease dates display. Edit dialog with tabs: Dane, Zdjęcie, Załączniki
3. **Owners** - View all owners grouped with their apartments, active lease info, apartment photos
4. **Reservations** - Short-term booking management with guest, dates, pricing
5. **Leases** - Long-term rental contract management
6. **Finance** - Expenses (with categories), bank accounts, balance snapshots (tabs UI)
7. **Import** - Excel file upload parsing sheets: Rezerwacje, Umowy najmu, Saldo
8. **Attachments** - File uploads (UMOWA/ANEKS/INNY) via Object Storage with presigned URLs

## Database Tables
- apartments (id serial PK, name, location, address, owner_name, active, photo_url)
- reservations (id serial PK, reservation_number, apartment_id FK, start/end dates, guest_name, price/prepayment/surcharge decimal, status, created_at)
- leases (id serial PK, apartment_id FK, start/end dates, rent_amount, community_fee, tenant_name, description)
- expenses (id serial PK, date, category, amount, apartment_id FK, description, type FIXED/VARIABLE, vat_amount)
- accounts (id serial PK, name, type BANK/CASH/LOAN)
- account_snapshots (id serial PK, account_id FK, date, balance, notes)
- users (Replit Auth managed)

## API Endpoints
All require authentication. Defined in shared/routes.ts:
- GET/POST /api/apartments, GET/PUT/DELETE /api/apartments/:id
- GET/POST /api/reservations, PUT/DELETE /api/reservations/:id
- GET/POST /api/leases, PUT /api/leases/:id
- GET/POST /api/expenses
- GET/POST /api/accounts
- GET/POST /api/snapshots
- GET /api/stats/dashboard
- POST /api/import (multipart file upload)

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## Recent Changes
- 2026-02-06: Built complete application with all pages, Excel import with detailed logging, data-testid attributes on all interactive elements

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
  pages/          - Dashboard, Apartments, Owners, Reservations, Arrivals, Leases, Finance, Import, Employees, Terminarz, Lokalizacje, ServiceContracts, Placeholder, Landing
  components/     - Layout, Sidebar, DataTable, ui/ (shadcn components)
  hooks/          - use-auth, use-apartments, use-reservations, use-leases, use-expenses, use-accounts, use-stats
  lib/            - queryClient (TanStack Query v5)
server/
  routes.ts       - All API endpoints + Excel import logic
  storage.ts      - Database CRUD operations (IStorage interface)
  db.ts           - Drizzle database connection
  replit_integrations/ - Auth setup
shared/
  schema.ts       - Drizzle schema (apartments, reservations, leases, expenses, accounts, accountSnapshots, employees, medicalExams, blockades, locations, serviceContracts, serviceContractCategories, ownerPayments)
  routes.ts       - API contract with Zod schemas
  models/auth.ts  - User model for Replit Auth
```

## Key Features
1. **Dashboard** - Revenue/expense stats, bar chart, recent reservations, PRZYJAZDY tab (arrivals with PRZYJETA status)
2. **Apartments** - CRUD with name, location (6 fixed categories), address, owner, presentation photo, lease dates display. Edit dialog with tabs: Dane, Raty, Zdjęcie, Załączniki
3. **Owners** - View all owners grouped with their apartments, active lease info, apartment photos
4. **Reservations** - Full reservation management with columns: Numer, Data dodania, Apartament, Przyjazd, Wyjazd, Imię i nazwisko, Kwota pobytu, Zaliczka, Wpłacona kwota (editable inline), Pozostało do zapłaty (calculated), Status (DO_OPLACENIA/PRZYJETA/ANULOWANA). Red highlight for ANULOWANA. Sortable columns, date & status filters.
5. **Leases** - Long-term rental contract management
6. **Finance** - Expenses (with categories), bank accounts, balance snapshots (tabs UI)
7. **Import** - Excel file upload + HotRes CSV import for reservations
8. **Attachments** - File uploads (UMOWA/ANEKS/INNY) via Object Storage with presigned URLs
9. **Owner Payments** - Per-apartment payment tracking with 7 categories (Raty tab in apartment edit)
10. **HotRes Integration** - CSV import from HotRes export (exact format: number;status;add_date;arrival_date;departure_date;amount;paid;currency;rate_title;last_name;first_name;email;phone;address;city;zip;roomscodes;...)

## Reservation Status Values
- DO_OPLACENIA - payment pending
- PRZYJETA - accepted/confirmed
- ANULOWANA - cancelled (displayed in red)

## Database Tables
- apartments (id serial PK, name, location, address, owner_name, active, photo_url)
- reservations (id serial PK, reservation_number, apartment_id FK, add_date, start/end dates, guest_name, price/prepayment/paid_amount/surcharge decimal, status, created_at)
- leases (id serial PK, apartment_id FK, start/end dates, rent_amount, community_fee, tenant_name, description)
- expenses (id serial PK, date, category, amount, apartment_id FK, description, type FIXED/VARIABLE, vat_amount)
- accounts (id serial PK, name, type BANK/CASH/LOAN)
- account_snapshots (id serial PK, account_id FK, date, balance, notes)
- employees (id serial PK, firstName, lastName, phone, email, pesel, birthDate, cooperationType, contractType, contractStart, contractEnd, position, hourlyRate, comment, status, photoUrl)
- medical_exams (id serial PK, employee_id FK, examName, examDate, validUntil)
- blockades (id serial PK, apartment_id FK, startDate, endDate, reason)
- locations (id serial PK, name, address, photoUrl, sortOrder) - dynamic apartment location categories
- service_contracts (id serial PK, name, categoryId FK, signDate, duration, endDate, serviceAddress, monthlyPrice)
- service_contract_categories (id serial PK, name, sortOrder) - categories for service contracts (Vectra, Media, Energa, etc.)
- owner_payments (id serial PK, apartment_id FK, category, amount, date, description)
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
- GET/POST /api/apartments/:id/payments, DELETE /api/owner-payments/:id
- POST /api/hotres/import-csv (multipart CSV file upload from HotRes export)
- GET /api/hotres/test, POST /api/hotres/sync (API integration - kept for future use)
- GET/POST /api/employees, PUT/DELETE /api/employees/:id
- GET/POST /api/employees/:id/medical-exams, DELETE /api/medical-exams/:id
- GET/POST /api/blockades, DELETE /api/blockades/:id
- GET/POST /api/locations, PUT/DELETE /api/locations/:id
- GET/POST /api/service-contracts, PUT/DELETE /api/service-contracts/:id
- GET/POST /api/service-contract-categories, DELETE /api/service-contract-categories/:id

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## Recent Changes
- 2026-02-06: Built complete application with all pages, Excel import with detailed logging, data-testid attributes on all interactive elements
- 2026-02-06: Added owner payments system (ownerPayments table, Raty tab in apartment edit dialog)
- 2026-02-06: Added HotRes integration - CSV import from HotRes export (Serwis > Rezerwacje > Eksport CSV), plus API connection test/sync endpoints for future use
- 2026-02-06: HotRes CSV parser supports auto-detection of column names (PL/EN), separators (;/,/tab), and date formats
- 2026-02-10: Updated reservation schema: added addDate, paidAmount fields; changed status values to DO_OPLACENIA/PRZYJETA/ANULOWANA
- 2026-02-10: Updated HotRes CSV parser to match exact HotRes export format (number;status;add_date;arrival_date;departure_date;amount;paid;...;last_name;first_name;...;roomscodes;...)
- 2026-02-10: Rebuilt Reservations page with full column set, sortable headers (asc/desc), date & status filters, inline paidAmount editing, status editing, red row highlight for ANULOWANA
- 2026-02-10: Added PRZYJAZDY tab to Dashboard showing PRZYJETA reservations chronologically with sorting and date filtering
- 2026-02-10: Added Przyjazdy as separate page (/arrivals) with sidebar navigation
- 2026-02-10: Restructured sidebar into sections: Kokpit/Finanse-Prognoza/Kalendarz, REZERWACJE, FINANSE, UMOWY, USTAWIENIA with separators and section titles
- 2026-02-10: Added company logo to sidebar, created placeholder pages for future sections
- 2026-02-10: Added Employee management system - employees table (16 fields: name, phone, email, pesel, birthDate, cooperationType ETAT/PRACA_NA_H, contractType, contractStart/End, position, hourlyRate, comment, status AKTYWNY/NIEAKTYWNY, photoUrl), full CRUD API, Employees page with table view, add/edit dialog with conditional fields
- 2026-02-10: Added employee preview dialog with tabs: Dane Identyfikacyjne (all employee fields displayed) and Medycyna Pracy (medical exams tracking with exam name, date, validity, remaining days calculation, color-coded warnings)
- 2026-02-10: Added medicalExams table (employeeId FK, examName, examDate, validUntil) with full CRUD API
- 2026-02-10: Added Terminarz (graphical calendar) - Gantt-chart timeline view for reservations with apartment rows, colored reservation bars, blockade support, date range navigation, 1-6 month view selector, location filter, add reservation/blockade dialogs, today line marker, hover tooltips
- 2026-02-10: Added blockades table (apartmentId FK, startDate, endDate, reason) with full CRUD API for blocking apartment periods
- 2026-02-10: Added Locations management system - locations table with CRUD API, Lokalizacje page under USTAWIENIA, 5 default seeded locations (GRAND BALTIC, BULWAR PORTOWY, WCZASOWA, NA WYDMIE, PRZEWŁOKA)
- 2026-02-10: Added Service Contracts system - serviceContracts + serviceContractCategories tables, full CRUD API, tabs-based UI with dynamic categories (seeded: Vectra, Media, Energa, Marketing&Reklama, Canal+, Inne), add contract form with fields (name, sign date, duration, end date, service address, monthly price)
- 2026-02-10: Enhanced Terminarz: rounded-md corners on reservation/blockade bars, status-based colors (DO_OPLACENIA=#f59e0b, PRZYJETA=#22c55e, ANULOWANA=#ef4444, BLOKADA=#9ca3af), Settings icon with color customization dialog (saved to localStorage), reservation preview dialog on click, apartments dynamically grouped by database locations
- 2026-02-10: Added collapsible sidebar sections - click section title to expand/collapse, state persisted in localStorage (key: sidebar-collapsed-v1), smooth animation with chevron rotation
- 2026-02-10: Sidebar accent color #5ADBFA for active navigation items
- 2026-02-10: Added reservation edit dialog (full form) to both Reservations and Arrivals pages, data syncs between tabs via shared useUpdateReservation hook + query cache invalidation
- 2026-02-10: Added company balance section to Dashboard top - shows total sum across all money sources with individual account cards
- 2026-02-10: Seeded 7 company accounts: Pekao SA, Santander, Gotówka, Saldo - M. Latasiewicz, Saldo - J. Głodkowska, Kryptowaluty, Pożyczki
- 2026-02-10: Added GET /api/company-balance endpoint returning latest balance per account + total
- 2026-02-10: Added hotresName field to apartments table - "Nazwa w HotRes" field in apartment edit (Dane tab) for matching imported HotRes reservations to apartments. HotRes CSV import now checks hotresName first, then falls back to regular name matching.
- 2026-02-10: Added group reservation support - apartmentIds integer[] column in reservations table. HotRes CSV import splits comma/plus/slash-separated roomscodes into individual apartments, stores all IDs in apartmentIds. Terminarz shows group reservations on all their apartments' rows with count badge. Reservations/Arrivals pages display all apartment names for group reservations.
- 2026-02-17: Added Sublease (Podnajem) management system - subleases table (tenantType, firstName, lastName, companyName, nip, street, postalCode, city, peselOrPassport, phone, email, invoiceEmail, vatRate, apartmentId FK, startDate, endDate, rentAmount, additionalFees), subleasePayments table (title, category, amount, dueDate, status), subleaseAttachments table (category, fileName, objectPath). Full CRUD API. Subleases page with table + 3-tab dialog (DANE/OPŁATY/ZAŁĄCZNIKI). Integrated into Terminarz with purple (#8b5cf6) bars. Route: /contracts-subrent
- 2026-02-17: Navigation restructure - removed UMOWY inne/Najmu, added PODNAJEM section (Umowy Podnajem, Rozliczenie, Rozliczenie mediów), added Saldo - M. Cieślak, reorganized sidebar sections
- 2026-02-17: Added app_users table (email, firstName, lastName, passwordHash, permissions[], active) with full CRUD API for user account management
- 2026-02-17: Created UserAccounts page (/user-accounts) with permissions checkboxes per app section
- 2026-02-17: Created SubrentSettlement page (/subrent-settlement) showing aggregated sublease payments across active subleases
- 2026-02-17: Created Forecast page (/forecast) - P/R/S spreadsheet view for revenue forecasting per apartment/location, data saved to localStorage
- 2026-02-17: Created CostsApartments page (/costs-apartments) - P/R/S spreadsheet for apartment costs grouped by location and owner payment categories
- 2026-02-17: Added expiring medical exams alert banner to Employees page (shows exams expiring within 60 days)
- 2026-02-17: Added GET /api/medical-exams/all endpoint for fetching all employee exams with employee names
- 2026-02-17: Added ROZLICZENIE ROCZNE to saldo categories
- 2026-02-17: Fixed Saldo import to pass personName parameter for person-specific data separation
- 2026-02-17: Enabled Saldo pages for Jolanta Głodkowska and Mateusz Cieślak

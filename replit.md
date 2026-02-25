# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a comprehensive Polish-language application designed for financial management of apartment rentals, covering both short-term and long-term leases. It offers tools for expense tracking, bank account management, and financial dashboards, operating exclusively with PLN currency. The system aims to provide property owners and managers with a unified platform to monitor financial health, streamline operations, and manage various aspects of property and tenant administration, including reservations, leases, financial reporting, employee management, and document handling.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## System Architecture
The application features a modern full-stack architecture.
-   **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, and Framer Motion.
-   **Backend**: Express.js with TypeScript.
-   **Database**: PostgreSQL on Neon, accessed via Drizzle ORM.
-   **Authentication**: Replit Auth (OIDC).
-   **Data Import**: `xlsx` library for Excel, and CSV imports from HotRes.
-   **File Storage**: Object Storage with presigned URLs for attachments.

**V2Koszty Top Tiles Architecture**: The 3 top tiles (Koszty apartamenty, Koszty operacyjne, Razem) receive their values via `onTotalsChange` callbacks from child components (`CostsApartmentsContent`, `CostsExpensesContent`). This ensures tiles show identical numbers to the tables below. Both TabsContent use `forceMount` to guarantee children mount on page load. Apartment costs come from DB table `apt_cost_data` via `GET /api/apt-cost-data?year=X`; operational costs from DB table `op_cost_data` via `GET /api/op-cost-data?year=X` + server forecasts (same as what `grandTotal` in each child computes). Both use 600ms debounced batch writes via `POST /api/apt-cost-data/bulk` and `POST /api/op-cost-data/bulk`.

**Shared Data Architecture (DB, not localStorage)**: All business data is stored in PostgreSQL and shared across all users:
- `apt_cost_data` (year, entryId, category, month, prognoza, realized) — apartment cost grid
- `apt_cost_settings` (entryId PK, categories, colors, entryColor, sortOrder) — apartment settings/colors
- `op_cost_data` (year, catId, itemIdx, month, prognoza, realized) — operational cost grid
- `app_config` key `op-cost-categories` — operational cost categories structure
- `app_config` key `terminarz-colors` — Terminarz apartment color map
- `import_metadata` type `data_backup` — tracks last backup time (shared across users)
Auto-migration: on first load, if DB is empty and localStorage has data, it migrates automatically then clears localStorage.

**Core Features and Design:**
-   **Financial Management**: Dashboard overview, detailed expense tracking, bank account management, balance snapshots, and owner payments. The FINANSE section contains: Przychody (V2Przychody), Koszty (V2Koszty with 2 tabs: Apartamenty + Operacyjne). V2Prognoza, V2Realizacja, Analizy, ApartmentSchedule, and CashFlowForecast pages have been removed; their routes redirect to current equivalents. CostsApartments.tsx and CostsExpenses.tsx files are retained as embedded components within V2Koszty. A dedicated Prognoza Przychodów page (`/v2/prognoza-przychodow`) allows per-apartment monthly revenue forecasting using DB `revenue_forecasts` table — accessible via Ustawienia only (not in sidebar). Sidebar storage key is `sidebar-config-v11`.
-   **Property & Rental Management**: CRUD operations for apartments, reservation management (short-term bookings with status tracking, group support), and lease management (long-term contracts). A Gantt-chart-style calendar (Terminarz) visualizes reservations, blockades, and subleases with drag-and-drop functionality.
-   **Document & Workflow Automation**: AI-powered PDF contract import (scanned PDF via GPT-4o vision OCR for data extraction), Word contract generation, invoice generation (with detailed items, VAT, payment tracking, PDF export), and cost invoice management (Dokumenty Księgowe) with drag-drop upload, status tracking, and expense linking. Handover protocols for subleases (Protokoły zdawczo-odbiorcze) with PDF generation.
-   **User & Employee Management**: Internal user account management with role-based permissions, and full CRUD for employee records including medical exam tracking.
-   **Reporting & Analytics**: Aggregated sublease settlements, revenue forecasting, apartment cost analysis, detailed revenue pages, occupancy rates (including subleases as 100% occupancy), profitability rankings (with sublease revenue, apartment costs from costForecasts, and rentowność column; Grand Baltic grouped as one entry), year-over-year comparison (including sublease revenue), apartment comparison (with sublease revenue and costForecasts-based expenses), cash flow forecast (costs sourced from costForecasts + operationalCostForecasts + variableCostForecasts; no installments), and price seasonality analysis. PDF report exports for various financial summaries.
-   **Notifications & Reminders**: Dashboard reminders for overdue payments, expiring medical exams, leases/subleases. An internal notification center for critical alerts.
-   **UI/UX**: Collapsible sidebar, consistent Polish language UI, clean design with Tailwind CSS and shadcn/ui, dark mode support, global search, breadcrumbs, and sticky table headers. CostsApartments page features location-based tabs (Grand Baltic, Bulwar Portowy, Wczasowa, Na Wydmie, Przewłoka + "Wszystkie") for filtering by location, with per-apartment colored rows and color picker dialog. Default tab is "GRAND BALTIC"; "Wszystkie" is at the end. Tab selection persists in localStorage (`costs-apartments-location-tab`). V2Koszty top tiles show prognoza + "Zrealizowane: X PLN" (apt costs from localStorage, op costs from actualExpensesByMonth). CostsApartments has 3 annual tiles (removed "Lokalizacje", added % realizacji to "Zrealizowane koszty"), 3 monthly tiles (bieżący miesiąc) with click→scroll+highlight to current month column, Sheet sidebars for apartment summary and category monthly breakdown, Palette icon for color dialog. CostsExpenses has 3 tiles (down from 5, removed "Zaległe płatności" and "Koszty miesięczne", simplified counts, "Zrealizowane" instead of "Saldo"). V2Przychody has per-apartment expandable year comparison table (BarChart3 toggle, lazy-fetches /api/v2/apartment-trend/{id}, shows months × years). SourceComparison: "Booking.com" key (was "Booking") in SOURCE_COLORS fixes classification bug.
-   **CRM**: Customer database with CRUD, segmentation, search, filtering, and tracking of total stays and revenue.
-   **Task Management**: Things 3-inspired task system with projects, sections, tasks (priority, due date, recurring), smart views, and a dashboard widget.
-   **Architectural Patterns**: Zod schemas for API validation, TanStack Query for data fetching/caching, and an `IStorage` interface for database abstraction.

## External Dependencies
-   **Replit Auth**: User authentication.
-   **PostgreSQL (Neon)**: Primary database.
-   **xlsx library**: Excel file parsing.
-   **date-fns**: Date formatting and manipulation with Polish locale.
-   **HotRes**: CSV export integration for reservation data import.
-   **jsPDF + jspdf-autotable**: PDF report generation.
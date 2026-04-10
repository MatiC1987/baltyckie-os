# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a comprehensive Polish-language application for financial management of apartment rentals. It provides tools for expense tracking, bank account management, and financial dashboards, exclusively in PLN currency. The system streamlines operations and manages various aspects of property and tenant administration, including reservations, leases, financial reporting, employee management, and document handling. The project's vision is to unify financial oversight and operational tasks for rental properties, offering a robust solution for efficient property management.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Custom email+password login with WebAuthn biometric support (30-day session persistence)

## System Architecture
The application employs a modern full-stack architecture designed for scalability and maintainability.

**Frontend:** Developed with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, and Framer Motion, ensuring a responsive and intuitive user experience with dark mode support. UI/UX decisions include collapsible sidebars, global search, breadcrumbs, mobile responsiveness with a bottom navigation bar, and adaptive table layouts.
**Backend:** Built on Express.js with TypeScript, providing robust API endpoints.
**Database:** PostgreSQL hosted on Neon, managed with Drizzle ORM.
**Authentication:** Custom email+password login with WebAuthn biometric support for the main application, complemented by a JWT-based system for the Recepcja Panel.
**Data Handling:** Utilizes Zod schemas for API validation and TanStack Query for efficient data fetching and caching. An `IStorage` interface provides database abstraction.

**PWA Features:** Includes manifest, service worker for caching and offline support, install prompts, update notifications, splash screen, push notifications, background sync, badge API, haptic feedback, and orientation lock.

**Mobile UX Features:** Incorporates responsive components like `ResponsiveTable`, `ResponsiveFormDialog`, `SwipeableRow`, and `Pull-to-refresh`. It also features a contextual bottom navigation, mobile-optimized calendars, and forms designed for touch interfaces.

**Core Feature Specifications:**
*   **Financial Management:** Dashboards with balance forecasts, expense tracking, bank account management, owner payments, and financial reporting, including `Saldo Firmowe`, `V2Przychody`, and `Przychody Dodatkowe` (one-off non-operational revenues like vehicle/property sales, integrated into balance forecast).
*   **Property & Rental Management:** CRUD for apartments, reservations, and long-term leases. A Gantt-chart-style calendar (`Terminarz`) for visual management.
*   **Document & Workflow Automation:** AI-powered PDF contract import (GPT-4o vision OCR), Word contract generation, invoice generation, cost invoice management, and automated PDF generation for accounting notes and handover protocols.
*   **User & Employee Management:** Role-based user accounts, employee records with medical exam and training tracking, and contract management with PDF generation and expiry reminders. Includes an HR calendar.
*   **RCP (Rejestrator Czasu Pracy - Time Tracking):** A GPS-based time tracking module with employee and admin panels, featuring a `GrafikEnhanced` component for shift scheduling and enhanced reports. GPS tracking uses `watchPosition` API (not `setInterval`+`getCurrentPosition`) for iOS reliability, with `visibilitychange` listener to resume after screen lock/unlock, offline buffering of up to 20 positions, and 25-second minimum send interval. PIN management endpoint: `PUT /api/employees/:id/pin` (placed before general `PUT /api/employees/:id` in routes.ts). **Worker App (TimeClock):** Apple-style UI redesign with bottom Tab Bar (5 tabs: Dziś, Zadania, Km, Historia, Więcej). "Więcej" tab contains sub-views: Grafik, Podsumowanie, Urlopy, Instrukcja (renders docs/instrukcja-rcp-pracownik-etat.md or godzinowy.md based on cooperationType), Wyloguj. Tasks tab shows daily tasks with date navigation and status buttons (Rozpocznij/Zakończ). Km tab manages mileage entries with form dialog. All worker endpoints use JWT Bearer auth (not PIN header). DB tables: `employee_tasks`, `task_comments`, `mileage_entries`, `schedule_templates`. Full CRUD endpoints in routes.ts (admin) and recepcja-routes.ts (Recepcja). **GrafikEnhanced Apple-style redesign:** Tap & Pick (click empty cell → preset chips: 8-16, 8-15, 9-17, 9-16 + "Inne…" custom time picker). Etat/hourly employee split with section headers and badges (blue=etat, orange=hourly). Norm bars (visual progress bars for monthly hours vs 168h norm). "Dziś pracują" tab view showing who works today with shift details. Mobile responsive list view (cards per day instead of table on mobile). Today column highlighting in schedule grid.
*   **Reporting & Analytics:** Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates, profitability, and cash flow forecasts with PDF export.
*   **Notifications & Reminders:** Dashboard-integrated reminders for various events, an internal notification center, and push notification support.
*   **Recepcja Panel:** An independent panel with JWT authentication for reception managers, offering a dashboard, read-only module access, payment toggling, cost invoice upload, meter reading submission, tenant data management, and full RCP admin. Includes an `Usterki` module. **Instrukcja page** at `/recepcja/instrukcja` renders `docs/instrukcja-rcp-recepcja.md` as formatted guide.
*   **Media Settlement Workflow:** Manages electricity charges from meter reading submission, verification, auto-generation of settlements, to payment tracking. Supports electricity invoice OCR.
*   **Sprawy Sądowe (Legal Cases):** Master-detail view for managing legal cases with a chronological timeline, event details, and attachment support.
*   **Dashboard:** Modular design with various widgets for quick insights.
*   **Rezerwacje:** Enhanced status badges, batch actions, saved filters, and mini timeline.
*   **Podnajem Hub:** Dashboard tab for active contracts, payments, and alerts.
*   **Bank Import:** Duplicate detection, categorization rules, balance impact preview, multi-bank CSV support, and GoCardless integration for automatic transaction fetching. **Bank Transaction Assignment:** Links imported transactions to operational costs, apartment costs, or sublease payments. Features per-transaction assignment dropdown, batch select/import/skip, duplicate amount warnings with confirm dialog, auto-suggest from mapping rules, and status badges (assigned/skipped). Backend mapping rules CRUD with pattern-based auto-matching.
*   **Ustawienia:** Includes NIP/REGON validation, config export/import, notification configuration, and settings change history.
*   **Landing Page:** Animated background, quick panel access, and system online indicator.
*   **Salda:** Person overview cards with trend charts and color-coded balances. Sortable column headers (date, operation, category, cash, card) with sort direction icons. Collapsible filter panel with search, date range, entry kind (PRZYCHOD/KOSZT), category, payment method, type, and cost status filters. "Wyświetlono X z Y" counter when filters are active. Non-editable "Wprowadził" (createdBy) column shows who created each entry — set automatically from logged-in user on POST, never overwritten on PUT. **Cost Assignment:** Inline cost assignment identical to bank transactions — expandable rows with target dropdown (operational/apartment/sublease), assign/skip/unskip buttons, cost status badges (green=assigned, amber=pending, grey=skipped), green row highlighting for assigned entries. **AI Categorization:** "Kategoryzuj AI" button batch-categorizes pending entries using GPT-4o-mini, storing suggestions in `aiCategory` column displayed as purple "AI:" hints. Pending/assigned counts shown in summary card. Backend endpoints: `POST /api/saldo/import-to-targets`, `/api/saldo/:id/skip`, `/api/saldo/:id/unskip`, `/api/saldo/ai-categorize`, `/api/saldo/check-duplicates`. DB columns added: `ai_category`, `cost_imported`, `cost_skipped`, `cost_target_type`, `cost_target_cat_id`, `cost_target_item_idx`, `cost_target_entry_id`, `cost_target_category`, `cost_target_sublease_payment_id`. Migration: `scripts/migrate-saldo-cost-assignment.ts`. Recepcja Saldo view is completely unaffected.
*   **Saldo Import:** One-time import script (`scripts/import-saldo-2026.ts`) parsed Excel data for Małgorzata Latasiewicz: 428 entries from Jan 1 2026, initial balance 28,950.70 PLN, 15 predefined categories. Category typos auto-corrected (WYPŁAZA→WYPŁATA, PRZYKAZD→PRZYJAZD, zalkupy→ZAKUPY). Import runs in a single DB transaction. To re-run: `npx tsx scripts/import-saldo-2026.ts`.

## External Dependencies
*   **@simplewebauthn/server + @simplewebauthn/browser:** WebAuthn biometric authentication.
*   **bcryptjs:** Password hashing.
*   **PostgreSQL (Neon):** Core relational database.
*   **xlsx library:** For parsing Excel files.
*   **date-fns:** Date formatting and manipulation with Polish locale.
*   **HotRes:** Integration for importing reservation data and managing cleaning fees.
*   **jsPDF + jspdf-autotable:** For generating PDF reports and documents.
*   **Leaflet + react-leaflet:** Interactive map functionalities for RCP module.
*   **jsonwebtoken:** JWT-based authentication for Recepcja panel.
*   **web-push:** Push notification delivery.
*   **GoCardless Bank Account Data API:** Automatic bank transaction fetching via PSD2/PolishAPI.

## Key Pages & Routes
*   `/konta-firmowe` — **Konta Firmowe** page: Full bank transaction history per account with tabs (Pekao SA / Santander). Features: infinite scroll (30 per load), sticky table headers, compact rows, summary cards (balance, income/expense, pending count), date filters (this month/last month/quarter/year/all), text search, cost status filter. Inline cost assignment and skip from expanded transaction rows. After CSV import in `/import-bankowy`, user is redirected here with `?status=pending`. Component: `client/src/pages/CompanyAccounts.tsx`. Backend: `GET /api/bank-transactions/history` with accountId, dateFrom, dateTo, search, costStatus, offset, limit params.
*   Auto-balance after import: `POST /api/bank-transactions/bulk` now creates an `account_snapshot` from the latest transaction's balance with note "Import bankowy".
# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a comprehensive Polish-language application for financial management of apartment rentals (short-term and long-term). It provides property owners and managers with tools for expense tracking, bank account management, and financial dashboards, exclusively in PLN currency. The system streamlines operations and manages various aspects of property and tenant administration, including reservations, leases, financial reporting, employee management, and document handling. The project aims to unify financial oversight and operational tasks for rental properties.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## System Architecture
The application utilizes a modern full-stack architecture.

**Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, and Framer Motion for a responsive and intuitive user experience with dark mode support. UI elements like collapsible sidebars, global search, and breadcrumbs ensure ease of navigation. Mobile responsiveness is a priority, featuring a bottom navigation bar and adaptive table layouts.
**Backend:** Express.js with TypeScript, providing robust API endpoints for data management.
**Database:** PostgreSQL on Neon, accessed via Drizzle ORM.
**Authentication:** Replit Auth for the main application, with a separate JWT-based system for the Recepcja Panel.
**Data Import:** Supports `xlsx` for Excel and CSV imports from HotRes.
**File Storage:** Object Storage with presigned URLs for attachments.
**Architectural Patterns:** Zod schemas for API validation, TanStack Query for data fetching/caching, and an `IStorage` interface for database abstraction.

**Core Features:**

*   **Financial Management:**
    *   Dashboard provides an overview of financial health, including a 36-month company balance forecast chart widget (`BalanceForecastChartWidget`) with summary tiles and interactive Recharts area chart.
    *   Detailed expense tracking (apartment and operational costs).
    *   Bank account management and balance snapshots.
    *   Owner payments and comprehensive financial reporting.
    *   `V2Koszty` features top tiles reflecting child component data for consistency.
    *   `Saldo Firmowe` provides a 60-month rolling company balance forecast, incorporating various revenue and cost sources, with UI for tiles, charts, and detailed tables.
    *   `V2Przychody` includes per-apartment expandable year comparison tables.
    *   Dedicated revenue forecasting (`/v2/prognoza-przychodow`) per apartment with location summary tiles, bulk edit dialog (set value/percent/long-term/short-term marking), Excel export, and visual purple highlighting for long-term rental months. DB field: `revenue_forecasts.rental_type` (null=short-term, "LONG"=long-term).
*   **Property & Rental Management:**
    *   CRUD operations for apartments, reservations (short-term, group support, status tracking), and leases (long-term contracts).
    *   Gantt-chart-style calendar (Terminarz) for visualizing reservations, blockades, and subleases with drag-and-drop.
*   **Document & Workflow Automation:**
    *   AI-powered PDF contract import (GPT-4o vision OCR for data extraction) for subleases and owner contracts.
    *   Owner contract PDF import: drag-drop upload → GPT-4o vision parsing → auto-matching owner/apartments → editable form → save with PDF in Object Storage. Endpoints: `POST /api/parse-owner-contract-pdf`, `POST /api/owner-contracts/:id/upload-pdf`, `GET /api/owner-contracts/:id/pdf`.
    *   Word contract generation and invoice generation (with PDF export).
    *   Cost invoice management (Dokumenty Księgowe) with drag-drop upload and status tracking.
    *   Document templates page (`/document-templates`) with categories: "Umowy" (lease templates), "Dokumenty księgowe" (accounting note template). Templates generated via `server/generate-templates.ts` using `docx` library, uploaded to Object Storage.
    *   Accounting note (Nota księgowa) PDF generation from media settlement reports via `POST /api/accounting-notes/generate` (jsPDF + jspdf-autotable). Includes company logo, QR code, issuer/tenant details, media consumption table, and total.
    *   Handover protocols for subleases with PDF generation.
*   **User & Employee Management:**
    *   Internal user accounts with role-based permissions.
    *   CRUD for employee records including medical exam tracking.
    *   `Employee Trainings` for certification tracking with expiry alerts.
    *   `Employee Contracts` for managing various contract types with PDF generation and expiry reminders.
*   **RCP (Rejestrator Czasu Pracy):**
    *   GPS-based time tracking module with employee (public) and admin (authenticated) panels.
    *   Employee panel features PIN login, live clock, shift timer, clock-in/out/break, GPS zone validation, automatic GPS tracking, leave request management, 14-day schedule view ("Mój grafik"), monthly hours summary with progress bar, and leave balance display. Endpoints: `GET /api/time-clock/my-schedule`, `GET /api/time-clock/my-summary`.
    *   Admin panel (`/rcp/admin`) includes dashboard, presence management, work schedules, leave management with balance, reports, GPS locations, and detailed GPS tracking with map visualization.
    *   **GrafikEnhanced** (`client/src/components/GrafikEnhanced.tsx`): Shared work schedule component used by both admin and Recepcja panels. Features: (1) HTML5 drag & drop shifts between days/employees with conflict validation, (2) weekly templates — define Mon-Sun pattern and auto-fill the month, (3) hours summary with 168h monthly norm comparison (color-coded green/yellow/red), (4) conflict validation — overlapping shifts and 11h rest period checks (warns, doesn't block), (5) weekly view toggle alongside monthly grid, (6) bulk assignment — multi-select employees × days with preset shifts. Props: `apiPrefix` and optional `fetchFn` for JWT auth.
*   **Reporting & Analytics:**
    *   Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates.
    *   Profitability rankings and year-over-year/apartment comparisons.
    *   Cash flow forecasts and price seasonality analysis.
    *   PDF report exports for various financial summaries.
*   **Notifications & Reminders:**
    *   Dashboard reminders for overdue payments, expiring documents (medical exams, leases).
    *   Internal notification center for critical alerts.
*   **Recepcja Panel (`/recepcja`):**
    *   Independent panel for reception managers with separate JWT authentication.
    *   Features include a dashboard with notifications, Saldo CRUD, read-only access to key modules, payment toggling, cost invoice upload, meter reading submission, handover protocols, tenant data submission workflow, tenant contact list, and full RCP admin.
    *   Includes `Usterki` module for issue/fault reporting with priority, status, and photo management, with an admin interface at `/usterki`.
    *   Admin-controlled sidebar visibility. All write operations are logged to `recepcja_audit_log`.

## Zaplanowane funkcjonalności (Roadmap)

### Nowe moduły:
1. Import wyciągów bankowych (CSV/MT940 + AI kategoryzacja)
2. Rozliczenie wynagrodzeń (Lista płac z RCP)
3. Historia pobytów w CRM (powiązanie gościa z rezerwacjami)
4. Rozliczenie końcowe podnajmu (checkout settlement)
5. Panel statystyk dla pracowników RCP
6. Harmonogram przeglądów technicznych z automatycznymi przypomnieniami
7. ~~Dynamiczne dashboardowe widżety (konfigurowalne)~~ ✅ Widget RCP (obecność pracowników + statystyki miesięczne) i Ostatnia aktywność (feed zdarzeń z activity_logs) dodane do Dashboard z pełną obsługą toggle/reorder

### UI/UX i wydajność:
8. Eksport do Excel z dowolnej tabeli
9. Lazy loading wszystkich stron (code splitting)
10. Ujednolicenie tabel w całej aplikacji
11. Paginacja po stronie serwera
12. Animacje i mikro-interakcje
13. Poprawienie spójności wizualnej sidebara (subtelne gradienty/efekty)
14. Wskaźniki postępu i stany ładowania
15. Tryb drukowania (print-friendly CSS)

### Odłożone na później:
- Ulepszone widoki mobilne (karty zamiast tabel na małych ekranach)

## External Dependencies
*   **Replit Auth:** Main application authentication.
*   **PostgreSQL (Neon):** Primary database.
*   **xlsx library:** Excel file parsing.
*   **date-fns:** Date formatting and manipulation with Polish locale.
*   **HotRes:** CSV export integration for reservation data import.
*   **jsPDF + jspdf-autotable:** PDF report generation.
*   **Leaflet + react-leaflet:** Interactive maps for GPS location management in RCP module.
*   **jsonwebtoken + bcryptjs:** Recepcja panel JWT authentication.
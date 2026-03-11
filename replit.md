# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a comprehensive Polish-language application for financial management of apartment rentals, designed for property owners and managers. It provides tools for expense tracking, bank account management, and financial dashboards, exclusively in PLN currency. The system streamlines operations and manages various aspects of property and tenant administration, including reservations, leases, financial reporting, employee management, and document handling. The project's vision is to unify financial oversight and operational tasks for rental properties, offering a robust solution for efficient property management.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Custom email+password login with WebAuthn biometric support (30-day session persistence)

## System Architecture
The application employs a modern full-stack architecture designed for scalability and maintainability.

**Frontend:** Developed with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, and Framer Motion, ensuring a responsive and intuitive user experience with dark mode support. Key UI/UX decisions include collapsible sidebars, global search, breadcrumbs, mobile responsiveness with a bottom navigation bar, and adaptive table layouts.
**Backend:** Built on Express.js with TypeScript, providing robust API endpoints.
**Database:** PostgreSQL hosted on Neon, managed with Drizzle ORM.
**Authentication:** Custom email+password login (case-insensitive email) with WebAuthn biometric support for the main application (30-day token persistence via `auth_tokens` table), complemented by a JWT-based system for the Recepcja Panel. User management syncs passwords between `app_users` (UI) and `users` (auth) tables.
**Data Handling:** Utilizes Zod schemas for API validation and TanStack Query for efficient data fetching and caching. An `IStorage` interface provides database abstraction.

## PWA Features
*   **manifest.json** with shortcuts (Recepcja, RCP), full icon set (72-512px, any+maskable), and sub-panel manifests (`manifest-recepcja.json`, `manifest-rcp.json`) with dynamic loading based on URL path.
*   **Service Worker** (`client/public/sw.js`): Network-first API caching (offline fallback from cache), cache-first for hashed static assets, stale-while-revalidate for other static assets, offline.html fallback for navigation, push notification handling, background sync with IndexedDB offline queue.
*   **Install prompt** (`useInstallPrompt` hook, `InstallPrompt` component) with iOS step-by-step guide and Android native dialog, 30-day cooldown.
*   **Update notification** (`UpdateNotification` component) with SW update detection and "Odśwież" toast.
*   **Splash screen**: Inline CSS/HTML in index.html, removed after React render.
*   **Push Notifications**: VAPID keys (auto-generated/persisted in appConfig), `push_subscriptions` table, subscribe/unsubscribe/send endpoints, SW push+notificationclick handlers, `usePushNotifications` hook, settings UI in Ustawienia.
*   **Background Sync**: IndexedDB offline queue (`offline-queue.ts`), SW sync handler, `useOfflineSync` hook with online/offline detection and manual sync.
*   **Badge API**: `useAppBadge` hook showing overdue payments count, auth-guarded.
*   **Haptic feedback**: `haptic()` function via navigator.vibrate().
*   **Orientation lock**: `useOrientationLock` hook.

## Mobile UX Features
*   **ResponsiveTable** component: Desktop=table, Mobile=cards with expandable details. Used in Employees, Subleases.
*   **ResponsiveFormDialog** component: Desktop=Dialog, Mobile=full-screen bottom Sheet. Used in Reservations, Leases, CostsExpenses.
*   **SwipeableRow** component + `useSwipeAction` hook: Swipe-to-delete/complete on mobile. Used in Reservations, CostsExpenses.
*   **Pull-to-refresh** (`usePullRefresh` hook): Dashboard, RezerwacjeAll, RecepcjaDashboard, Koszty.
*   **Contextual BottomNav**: Dynamic content per section (Rezerwacje, Finanse, HR, etc.), active item shows label.
*   **Mobile Terminarz**: Agenda/list view on mobile instead of Gantt chart.
*   **Mobile forms**: 1-column layout, min 44px touch targets, 16px font (prevents iOS zoom).

**Core Feature Specifications:**
*   **Financial Management:** Comprehensive dashboards with 36-month balance forecasts, detailed expense tracking, bank account management, owner payments, and financial reporting. Includes features like `Saldo Firmowe` for 60-month rolling forecasts and `V2Przychody` with per-apartment expandable year comparison tables and revenue forecasting.
*   **Property & Rental Management:** CRUD operations for apartments, reservations (short-term, group, status tracking), and long-term leases. A Gantt-chart-style calendar (`Terminarz`) allows visual management of reservations, blockades, and subleases with drag-and-drop functionality.
*   **Document & Workflow Automation:** AI-powered PDF contract import (GPT-4o vision OCR) for subleases, owner contracts, and electricity invoices. Word contract generation, invoice generation, and cost invoice management. Includes a document templates page and automated PDF generation for accounting notes (Version A with VAT: Medium|Zużycie|Netto|VAT%|Brutto) and handover protocols. Accounting notes have status tracking (NOWA→WYSŁANA→ZAKSIĘGOWANA), ZIP download with auto-status change, and bulk actions. Cost invoice OCR (GPT-4o vision) extracts vendor, amount, invoice number. Grid/thumbnail view for documents.
*   **User & Employee Management:** Role-based internal user accounts, employee records with medical exam and training tracking, and various contract management with PDF generation and expiry reminders. Employee profile dialog with timeline, costs breakdown. HR calendar with expiration alerts.
*   **RCP (Rejestrator Czasu Pracy - Time Tracking):** A GPS-based time tracking module with employee (PIN login, shift management, leave requests, schedule view) and admin panels (dashboard, presence management, reports, GPS location tracking). Features a shared `GrafikEnhanced` component for drag-and-drop shift scheduling with conflict validation and weekly templates. Enhanced reports with Excel export, missing clock-in alerts, lateness/overtime trend charts.
*   **Reporting & Analytics:** Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates, profitability rankings, and cash flow forecasts. Various PDF report exports are available.
*   **Notifications & Reminders:** Dashboard-integrated reminders for overdue payments, expiring documents (medical exams, leases), pending meter readings, and an internal notification center for critical alerts. Notifications support panel targeting (`targetPanel`: null=admin, "recepcja"=recepcja). Push notification support with VAPID keys.
*   **Recepcja Panel:** An independent panel for reception managers with JWT authentication, offering a dashboard with payment trend sparkline, Saldo CRUD, read-only access to modules, payment toggling, cost invoice upload, meter reading submission, tenant data management, and full RCP admin with monthly reports. Includes an `Usterki` module for issue reporting. FAB for quick actions. IndexedDB offline cache. 30s notification polling.
*   **Media Settlement Workflow:** Full electricity charge structure (variable per kWh + fixed per month + VAT 23%). Recepcja submits meter readings (status: pending) → admin notified → verifies/approves → auto-generates settlement + nota księgowa PDF → recepcja notified. Electricity invoice OCR import (GPT-4o vision). Per-sublease independent charge configuration with rate change history. Payment tracking: `mediaSettlementReports` has `paidDate` + `paymentMethod` columns; recepcja panel "Rozliczenia mediów" tab in Dokumenty allows marking payments (date, method: przelew/gotówka/karta) with undo; dashboard shows unpaid count with noteNumber.
*   **Sprawy Sądowe (Legal Cases):** Master-detail drill-down layout with chronological timeline. Master view shows case cards with status, priority, case number, opposing party, amounts, and upcoming dates. Detail view shows: collapsible case summary (court info, parties, financials, dates), vertical timeline with colored event type icons (Rozprawa=red, Pismo=blue, Termin=orange, Decyzja=green, Płatność=yellow, Spotkanie=violet, Inne=gray), expandable event descriptions with attachment support (upload/download/delete via Object Storage). Backend: `legal_cases` + `legal_case_events` tables, event file upload at `POST /api/legal-case-events/:id/upload`, attachment delete at `DELETE /api/legal-case-events/:id/attachments`, file download at `GET /api/legal-case-files?path=...`.
*   **Dashboard:** Refactored into separate widget files in `client/src/components/dashboard/`. Widgets: CompanyBalanceCard, QuickActions, UnpaidArrivalsTab, UpcomingArrivalsTab, UpcomingDeparturesTab, UnpaidSubleasesTab, ExpiringLeasesTab, HrSummaryWidget, RcpSummaryWidget, RecentActivityWidget, BalanceForecastChartWidget.
*   **Rezerwacje:** Enhanced status badges with icons, batch actions (select-all, status change, delete), saved filters (localStorage), mini timeline for reservation history.
*   **Podnajem Hub:** Dashboard tab with active contracts, monthly rent, payments, overdue alerts. Expiring contract alerts (60/30/14 days). Tenant payment ranking. Rent timeline.
*   **Bank Import:** Duplicate detection, categorization rules, balance impact preview, multi-bank CSV (mBank, PKO BP, ING, Santander). GoCardless Bank Account Data API integration for automatic transaction fetching (PSD2/PolishAPI). Bank Connections page (`/bank-connections`) for managing GoCardless connections. Auto-sync banner in BankStatementImport page when connections exist.
*   **Ustawienia:** NIP/REGON checksum validation, config export/import, notification config panel (push/email), settings change history.
*   **Landing Page:** Animated gradient background, quick panel access buttons, system online indicator.
*   **Salda:** Person overview cards with mini sparkline trend charts, color-coded balances.

## External Dependencies
*   **@simplewebauthn/server + @simplewebauthn/browser:** WebAuthn biometric authentication (passkeys, fingerprint, Face ID).
*   **bcryptjs:** Password hashing for custom email+password authentication.
*   **PostgreSQL (Neon):** The core relational database.
*   **xlsx library:** Used for parsing Excel files.
*   **date-fns:** For date formatting and manipulation, specifically with Polish locale support.
*   **HotRes:** Integrates for importing reservation data via CSV exports. Per-apartment `cleaningFee` field is auto-added to reservation price during import (stored in `surcharge` field for audit). Managed via "Sprzątanie" tab on Apartments page. "Przelicz wstecz" button retroactively applies cleaning fees to existing reservations without surcharge.
*   **Climate Fee (Opłata klimatyczna):** Global monthly revenue line item stored in `revenue_forecasts` table (`climateFeeForecast`/`climateFeeActual` columns on `locationName='RAZEM'` records). Editable inline in V2Przychody page (ClimateFeeTable component). Included in KPI totals, chart, grand total, and RevenueForecastSection breakdown. API: `PUT /api/revenue-forecasts/climate-fee` for updates; returned in both `/api/v2/revenue-summary` and `/api/dashboard/revenue-forecast`.
*   **jsPDF + jspdf-autotable:** Utilized for generating PDF reports and documents.
*   **Leaflet + react-leaflet:** Powers interactive map functionalities for GPS location tracking in the RCP module.
*   **jsonwebtoken + bcryptjs:** Employed for JWT-based authentication in the Recepcja panel.
*   **web-push:** Push notification delivery with VAPID keys.
*   **GoCardless Bank Account Data API:** Automatic bank transaction fetching via PSD2/PolishAPI. Module: `server/gocardless.ts`. DB table: `gocardless_connections`. Env vars: `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`. Free tier (50 connections).

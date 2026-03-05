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
**Authentication:** Custom email+password login with WebAuthn biometric support for the main application (30-day token persistence via `auth_tokens` table), complemented by a JWT-based system for the Recepcja Panel.
**Data Handling:** Utilizes Zod schemas for API validation and TanStack Query for efficient data fetching and caching. An `IStorage` interface provides database abstraction.

**Core Feature Specifications:**
*   **Financial Management:** Comprehensive dashboards with 36-month balance forecasts, detailed expense tracking, bank account management, owner payments, and financial reporting. Includes features like `Saldo Firmowe` for 60-month rolling forecasts and `V2Przychody` with per-apartment expandable year comparison tables and revenue forecasting.
*   **Property & Rental Management:** CRUD operations for apartments, reservations (short-term, group, status tracking), and long-term leases. A Gantt-chart-style calendar (`Terminarz`) allows visual management of reservations, blockades, and subleases with drag-and-drop functionality.
*   **Document & Workflow Automation:** AI-powered PDF contract import (GPT-4o vision OCR) for subleases, owner contracts, and electricity invoices. Word contract generation, invoice generation, and cost invoice management. Includes a document templates page and automated PDF generation for accounting notes (Version A with VAT: Medium|Zużycie|Netto|VAT%|Brutto) and handover protocols. Accounting notes have status tracking (NOWA→WYSŁANA→ZAKSIĘGOWANA), ZIP download with auto-status change, and bulk actions.
*   **User & Employee Management:** Role-based internal user accounts, employee records with medical exam and training tracking, and various contract management with PDF generation and expiry reminders.
*   **RCP (Rejestrator Czasu Pracy - Time Tracking):** A GPS-based time tracking module with employee (PIN login, shift management, leave requests, schedule view) and admin panels (dashboard, presence management, reports, GPS location tracking). Features a shared `GrafikEnhanced` component for drag-and-drop shift scheduling with conflict validation and weekly templates.
*   **Reporting & Analytics:** Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates, profitability rankings, and cash flow forecasts. Various PDF report exports are available.
*   **Notifications & Reminders:** Dashboard-integrated reminders for overdue payments, expiring documents (medical exams, leases), pending meter readings, and an internal notification center for critical alerts. Notifications support panel targeting (`targetPanel`: null=admin, "recepcja"=recepcja).
*   **Recepcja Panel:** An independent panel for reception managers with JWT authentication, offering a dashboard, Saldo CRUD, read-only access to modules, payment toggling, cost invoice upload, meter reading submission, tenant data management, and full RCP admin. Includes an `Usterki` module for issue reporting.
*   **Media Settlement Workflow:** Full electricity charge structure (variable per kWh + fixed per month + VAT 23%). Recepcja submits meter readings (status: pending) → admin notified → verifies/approves → auto-generates settlement + nota księgowa PDF → recepcja notified. Electricity invoice OCR import (GPT-4o vision). Per-sublease independent charge configuration with rate change history.
*   **Sprawy Sądowe (Legal Cases):** Master-detail drill-down layout with chronological timeline. Master view shows case cards with status, priority, case number, opposing party, amounts, and upcoming dates. Detail view shows: collapsible case summary (court info, parties, financials, dates), vertical timeline with colored event type icons (Rozprawa=red, Pismo=blue, Termin=orange, Decyzja=green, Płatność=yellow, Spotkanie=violet, Inne=gray), expandable event descriptions with attachment support (upload/download/delete via Object Storage). Backend: `legal_cases` + `legal_case_events` tables, event file upload at `POST /api/legal-case-events/:id/upload`, attachment delete at `DELETE /api/legal-case-events/:id/attachments`, file download at `GET /api/legal-case-files?path=...`.
*   **Zadania Panel (Tasks):** An independent, mobile-first employee tasks panel with JWT authentication (e-baltyckie.pl/zadania). Inspired by Things 3, it offers views (Inbox, Today, Upcoming, Anytime, Someday, Logbook, Priority, Shared), inline task editing, projects with areas, tags, checklists, subtasks, deadlines, priorities, recurring tasks, sharing/assignment, and an admin interface. Admin: mateusz.cieslak@baltyckie.pl / BaltFin2025!MC. Backend optimized with batch DB operations for bulk actions and include=checklists in main fetch. Seed uses upsert logic to ensure admin credentials on every startup. Sidebar areas support drag-and-drop reordering (order persisted in localStorage key `tasksAreaOrder`), inline rename/delete, and cross-area project drag. Tasks have an `area` field — area view shows both projects (navigable) and directly assigned tasks; tasks can be assigned to areas via TaskDialog, TaskDetailPanel, and inline creation.

## External Dependencies
*   **@simplewebauthn/server + @simplewebauthn/browser:** WebAuthn biometric authentication (passkeys, fingerprint, Face ID).
*   **bcryptjs:** Password hashing for custom email+password authentication.
*   **PostgreSQL (Neon):** The core relational database.
*   **xlsx library:** Used for parsing Excel files.
*   **date-fns:** For date formatting and manipulation, specifically with Polish locale support.
*   **HotRes:** Integrates for importing reservation data via CSV exports.
*   **jsPDF + jspdf-autotable:** Utilized for generating PDF reports and documents.
*   **Leaflet + react-leaflet:** Powers interactive map functionalities for GPS location tracking in the RCP module.
*   **jsonwebtoken + bcryptjs:** Employed for JWT-based authentication in the Recepcja panel.
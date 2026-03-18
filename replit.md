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
*   **Financial Management:** Dashboards with balance forecasts, expense tracking, bank account management, owner payments, and financial reporting, including `Saldo Firmowe` and `V2Przychody`.
*   **Property & Rental Management:** CRUD for apartments, reservations, and long-term leases. A Gantt-chart-style calendar (`Terminarz`) for visual management.
*   **Document & Workflow Automation:** AI-powered PDF contract import (GPT-4o vision OCR), Word contract generation, invoice generation, cost invoice management, and automated PDF generation for accounting notes and handover protocols.
*   **User & Employee Management:** Role-based user accounts, employee records with medical exam and training tracking, and contract management with PDF generation and expiry reminders. Includes an HR calendar.
*   **RCP (Rejestrator Czasu Pracy - Time Tracking):** A GPS-based time tracking module with employee and admin panels, featuring a `GrafikEnhanced` component for shift scheduling and enhanced reports.
*   **Cennik (Pricing Module):** Calendar-based daily price management per apartment with pricing rules, audit trails, and various pricing-related pages (Calendar, Rules, Analytics, AI Pricing, Competitor Monitoring). Includes HotRes integration and a holidays table.
*   **Reporting & Analytics:** Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates, profitability, and cash flow forecasts with PDF export.
*   **Notifications & Reminders:** Dashboard-integrated reminders for various events, an internal notification center, and push notification support.
*   **Recepcja Panel:** An independent panel with JWT authentication for reception managers, offering a dashboard, read-only module access, payment toggling, cost invoice upload, meter reading submission, tenant data management, and full RCP admin. Includes an `Usterki` module.
*   **Media Settlement Workflow:** Manages electricity charges from meter reading submission, verification, auto-generation of settlements, to payment tracking. Supports electricity invoice OCR.
*   **Sprawy Sądowe (Legal Cases):** Master-detail view for managing legal cases with a chronological timeline, event details, and attachment support.
*   **Dashboard:** Modular design with various widgets for quick insights.
*   **Rezerwacje:** Enhanced status badges, batch actions, saved filters, and mini timeline.
*   **Podnajem Hub:** Dashboard tab for active contracts, payments, and alerts.
*   **Bank Import:** Duplicate detection, categorization rules, balance impact preview, multi-bank CSV support, and GoCardless integration for automatic transaction fetching.
*   **Ustawienia:** Includes NIP/REGON validation, config export/import, notification configuration, and settings change history.
*   **Landing Page:** Animated background, quick panel access, and system online indicator.
*   **Salda:** Person overview cards with trend charts and color-coded balances.

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
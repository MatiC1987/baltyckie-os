# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a full-stack Polish-language application designed for comprehensive financial management of apartment rentals. It caters to both short-term (Airbnb-style) reservations and long-term leases, offering tools for expense tracking, bank account management, and insightful financial dashboards. The system operates exclusively with PLN currency, providing a unified platform for property owners and managers to monitor their rental business's financial health, streamline operations, and manage various aspects of property and tenant administration. Key capabilities include reservation management, lease tracking, detailed financial reporting, employee management, and document handling.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## System Architecture
The application is built with a modern full-stack architecture.
-   **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui for UI components, Recharts for data visualization, and Framer Motion for animations.
-   **Backend**: Express.js with TypeScript for API development.
-   **Database**: PostgreSQL hosted on Neon, accessed via Drizzle ORM.
-   **Authentication**: Replit Auth (OIDC) handles user authentication.
-   **Data Import**: Utilizes the `xlsx` library for parsing Excel files and supports CSV imports from HotRes.
-   **File Storage**: Object Storage is used for attachments with presigned URLs.

**Core Features and Design:**
-   **Dashboard**: Provides an overview of revenue, expenses, recent reservations, and upcoming arrivals.
-   **Apartment Management**: CRUD operations for apartments, including location categories, owner details, photos, and associated lease/owner payment information.
-   **Reservation Management**: Comprehensive system for short-term bookings with detailed status tracking (DO_OPLACENIA, PRZYJETA, ANULOWANA), inline editing, filtering, and sorting capabilities. Supports group reservations.
-   **Lease Management**: Manages long-term rental contracts.
-   **Financial Tracking**: Dedicated sections for expenses (categorized), bank accounts, balance snapshots, and owner payments.
-   **Import Functionality**: Allows importing data via Excel files and HotRes CSV exports, with intelligent parsing.
-   **Employee Management**: Full CRUD for employee records, including medical exam tracking with expiry alerts.
-   **Calendar (Terminarz)**: A graphical Gantt-chart-style calendar for visualizing reservations, blockades, and subleases, offering date range selection and dynamic apartment grouping.
-   **Location Management**: Dynamic categories for apartment locations.
-   **Service Contract Management**: Tracking of service agreements with various categories.
-   **Sublease Management**: Comprehensive system for managing subleases, including tenant details, payments, deposits, and attachments.
-   **User Account Management**: Internal system for managing application users with role-based permissions.
-   **Reporting & Forecasting**: Includes pages for aggregated sublease settlements, revenue forecasting (P/R/S spreadsheet view per apartment/location), apartment cost analysis, and a detailed revenue page consolidating actual and forecasted income.
-   **Analytics (ANALIZY section)**: Occupancy rates per apartment with year/month filtering, profitability rankings with revenue bars, and year-over-year comparison with bar charts and monthly tables.
-   **Dashboard Reminders**: Automatic alert card showing overdue payments, expiring medical exams, expiring leases/subleases, with clickable links to relevant pages.
-   **Activity Log**: Tracks user actions (create/update/delete) across reservations, expenses, and subleases with timestamps and user attribution.
-   **CSV Export**: Semicolon-delimited CSV export with BOM for Excel compatibility on Reservations and Subleases pages.
-   **Reservation Notes**: Text notes field on reservations with FileText indicator in tables.
-   **Document Templates**: System for managing document categories and uploading/downloading document templates.
-   **Dark Mode**: Full dark mode support with theme toggle in the sidebar footer. CSS variables for both light and dark themes. Theme persists in localStorage.
-   **Dashboard KPI Cards**: Four summary cards at the top of the dashboard showing monthly revenue (with month-over-month change), reservation count, unpaid reservations, and total company balance.
-   **Global Search**: Ctrl+K shortcut or search button in top-right corner. Searches across reservations, apartments, and subleases with instant results.
-   **UI/UX**: Features a collapsible sidebar with sections for navigation, consistent Polish language UI, and a clean, modern design using Tailwind CSS and shadcn/ui. Accent color `#5ADBFA` for active navigation items. Chart colors use CSS variables (chart-1..5) for theme consistency.
-   **Architectural Patterns**: API endpoints are defined with Zod schemas for validation, and data fetching/caching is managed with TanStack Query. Database interactions are abstracted through an `IStorage` interface.

## External Dependencies
-   **Replit Auth**: For user authentication.
-   **PostgreSQL (Neon)**: As the primary database.
-   **xlsx library**: For parsing `.xlsx` Excel files.
-   **date-fns**: For date formatting and manipulation, specifically with the Polish locale.
-   **HotRes**: CSV export integration for importing reservation data.
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

**Core Features and Design:**
-   **Financial Management**: Dashboard overview, detailed expense tracking, bank account management, balance snapshots, and owner payments. The primary financial module (FINANSE v2) provides comprehensive forecasting (revenue, apartment costs, operational costs) with spreadsheet-like editing, historical trends, year-over-year comparisons, and plan vs. actual deviation analysis. Old standalone finance pages (Prognoza, Revenue, CostsApartments route, CostsExpenses route) have been removed from navigation and redirect to V2 equivalents. CostsApartments.tsx and CostsExpenses.tsx files are retained as embedded components within V2Koszty.
-   **Property & Rental Management**: CRUD operations for apartments, reservation management (short-term bookings with status tracking, group support), and lease management (long-term contracts). A Gantt-chart-style calendar (Terminarz) visualizes reservations, blockades, and subleases with drag-and-drop functionality.
-   **Document & Workflow Automation**: AI-powered PDF contract import (scanned PDF via GPT-4o vision OCR for data extraction), Word contract generation, invoice generation (with detailed items, VAT, payment tracking, PDF export), and cost invoice management (Dokumenty Księgowe) with drag-drop upload, status tracking, and expense linking. Handover protocols for subleases (Protokoły zdawczo-odbiorcze) with PDF generation.
-   **User & Employee Management**: Internal user account management with role-based permissions, and full CRUD for employee records including medical exam tracking.
-   **Reporting & Analytics**: Aggregated sublease settlements, revenue forecasting, apartment cost analysis, detailed revenue pages, occupancy rates, profitability rankings, and price seasonality analysis. PDF report exports for various financial summaries.
-   **Notifications & Reminders**: Dashboard reminders for overdue payments, expiring medical exams, leases/subleases. An internal notification center for critical alerts.
-   **UI/UX**: Collapsible sidebar, consistent Polish language UI, clean design with Tailwind CSS and shadcn/ui, dark mode support, global search, breadcrumbs, and sticky table headers. CostsApartments page features location-based tabs (Grand Baltic, Bulwar Portowy, Wczasowa, Na Wydmie, Przewłoka + "Wszystkie") for filtering by location, with per-apartment colored rows and color picker dialog. Tab selection persists in localStorage (`costs-apartments-location-tab`).
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
# Baltyckie Finanse - Apartment Rental Financial Management

## Overview
Baltyckie Finanse is a comprehensive Polish-language application for financial management of apartment rentals, designed for property owners and managers. It provides tools for expense tracking, bank account management, and financial dashboards, exclusively in PLN currency. The system streamlines operations and manages various aspects of property and tenant administration, including reservations, leases, financial reporting, employee management, and document handling. The project's vision is to unify financial oversight and operational tasks for rental properties, offering a robust solution for efficient property management.

## User Preferences
- Language: Polish (all UI text in Polish)
- Currency: PLN
- Date format: YYYY-MM-DD internally, displayed with date-fns pl locale
- Auth: Replit Auth integration

## System Architecture
The application employs a modern full-stack architecture designed for scalability and maintainability.

**Frontend:** Developed with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, and Framer Motion, ensuring a responsive and intuitive user experience with dark mode support. Key UI/UX decisions include collapsible sidebars, global search, breadcrumbs, mobile responsiveness with a bottom navigation bar, and adaptive table layouts.
**Backend:** Built on Express.js with TypeScript, providing robust API endpoints.
**Database:** PostgreSQL hosted on Neon, managed with Drizzle ORM.
**Authentication:** Replit Auth for the main application, complemented by a JWT-based system for the Recepcja Panel.
**Data Handling:** Utilizes Zod schemas for API validation and TanStack Query for efficient data fetching and caching. An `IStorage` interface provides database abstraction.

**Core Feature Specifications:**
*   **Financial Management:** Comprehensive dashboards with 36-month balance forecasts, detailed expense tracking, bank account management, owner payments, and financial reporting. Includes features like `Saldo Firmowe` for 60-month rolling forecasts and `V2Przychody` with per-apartment expandable year comparison tables and revenue forecasting.
*   **Property & Rental Management:** CRUD operations for apartments, reservations (short-term, group, status tracking), and long-term leases. A Gantt-chart-style calendar (`Terminarz`) allows visual management of reservations, blockades, and subleases with drag-and-drop functionality.
*   **Document & Workflow Automation:** AI-powered PDF contract import (GPT-4o vision OCR) for subleases and owner contracts, Word contract generation, invoice generation, and cost invoice management. Includes a document templates page and automated PDF generation for accounting notes and handover protocols.
*   **User & Employee Management:** Role-based internal user accounts, employee records with medical exam and training tracking, and various contract management with PDF generation and expiry reminders.
*   **RCP (Rejestrator Czasu Pracy - Time Tracking):** A GPS-based time tracking module with employee (PIN login, shift management, leave requests, schedule view) and admin panels (dashboard, presence management, reports, GPS location tracking). Features a shared `GrafikEnhanced` component for drag-and-drop shift scheduling with conflict validation and weekly templates.
*   **Reporting & Analytics:** Aggregated sublease settlements, revenue forecasting, cost analysis, occupancy rates, profitability rankings, and cash flow forecasts. Various PDF report exports are available.
*   **Notifications & Reminders:** Dashboard-integrated reminders for overdue payments, expiring documents (medical exams, leases), and an internal notification center for critical alerts.
*   **Recepcja Panel:** An independent panel for reception managers with JWT authentication, offering a dashboard, Saldo CRUD, read-only access to modules, payment toggling, cost invoice upload, meter reading submission, tenant data management, and full RCP admin. Includes an `Usterki` module for issue reporting.
*   **Zadania Panel (Tasks):** An independent, mobile-first employee tasks panel with JWT authentication. Inspired by Things 3, it offers five views (Inbox, Today, Upcoming, Someday, Logbook), inline task editing, and an admin interface for assigning tasks.

## External Dependencies
*   **Replit Auth:** Primary authentication for the main application.
*   **PostgreSQL (Neon):** The core relational database.
*   **xlsx library:** Used for parsing Excel files.
*   **date-fns:** For date formatting and manipulation, specifically with Polish locale support.
*   **HotRes:** Integrates for importing reservation data via CSV exports.
*   **jsPDF + jspdf-autotable:** Utilized for generating PDF reports and documents.
*   **Leaflet + react-leaflet:** Powers interactive map functionalities for GPS location tracking in the RCP module.
*   **jsonwebtoken + bcryptjs:** Employed for JWT-based authentication in the Recepcja panel.
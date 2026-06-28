# 002 – Business Model

**Status:** Draft
**Version:** 0.1

## Purpose
This document defines how Apartamenty Bałtyckie operates as a business. Every module must reflect these rules.

## Core business entities
1. Company
2. Business Partner
3. Contract
4. Apartment
5. Forecast
6. Revenue
7. Cost
8. Payment
9. Cash Position

## Business Partner
A partner represents the business relationship. A partner may own one or many apartments. All contracts, annexes and relationship history belong to the partner.

## Contract
A contract defines financial rules. Creating a contract automatically creates forecast entries, payment schedules and cost obligations.

For planning purposes contracts are treated as continuing beyond their formal end date until the user explicitly decides to terminate the business relationship.

## Apartment
An apartment is a business unit, not only a physical property. It aggregates revenue, costs, forecasts, operational data and performance.

## Revenue
Revenue is divided into:
- Short-term rental
- Sublease
- Other income

Every revenue stream contains Forecast, Actual and Variance.

## Costs
Costs are divided into:
- Contractual
- Operational
- Forecasted

Each cost has a calculation method (manual, contract, historical average, seasonal average or future AI-assisted method).

## Cash Position
Company cash forecast is calculated from forecasted revenues and forecasted costs. Apartment monthly balances are not primary decision metrics because payment schedules vary by contract.

## Automation rules
- New contract → create forecasts.
- New contract → create payment schedule.
- Contract change → update dependent forecasts.
- Payment completion → update cash forecast.
- Forecast update → update dashboards automatically.
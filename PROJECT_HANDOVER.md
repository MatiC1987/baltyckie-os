# PROJECT HANDOVER – Bałtyckie OS

**Status:** Handover v1.0  
**Audience:** Claude Code / AI engineering agent  
**Purpose:** Transfer the complete product vision, business logic and current decisions from ChatGPT collaboration to Claude Code so that development can continue in the repository without losing context.

---

## 1. Executive summary

Bałtyckie OS is an internal operating system for the company **Apartamenty Bałtyckie**. It is not meant to be a generic PMS, CRM or ERP. It is a decision-support and automation system for an apartment rental operator managing a portfolio of apartments in Ustka.

The core product philosophy is:

> The system should not merely record data. It should help the owner understand the current and future condition of the business and decide what to do next.

The current application is called **e-Bałtyckie 2.0**. It already exists and was copied into Replit. The task is to transform and evolve the existing application, not rebuild everything from zero.

Primary goal now: organize the project, preserve all decisions in repository documentation, and then continue implementation using precise specifications instead of vague prompts.

---

## 2. User and business context

Primary owner / decision maker: **Mateusz Cieślak**.

Business: **Apartamenty Bałtyckie**, operator of short-term and longer-term rental apartments in Ustka.

Important business characteristics:

- The company manages apartments in multiple locations, including: Bulwar Portowy, Na Wydmie, Wczasowa, Marynarki Polskiej / Grand Baltic, Przewłoka and other Ustka locations.
- The company works with apartment owners under different cooperation models.
- Historical business logic exists mostly in Mateusz's head and in current e-Bałtyckie 2.0.
- A major objective is to digitize that business logic into a maintainable system.

Main users:

- Mateusz – owner / main decision maker.
- Mateusz's father – partner / co-owner.
- Jolanta Głodkowska – accounting / documentation.

This is currently an internal company system, not a public SaaS product.

---

## 3. Product vision

Bałtyckie OS should answer three fundamental questions:

1. **Co się wydarzyło?** / What happened?
2. **Dlaczego się wydarzyło?** / Why did it happen?
3. **Co powinienem zrobić?** / What should I do?

Every feature must support at least one of these questions. Features that only look good but do not support decisions, automation, or operational efficiency should not be prioritized.

Bałtyckie OS should feel like premium business software: calm, clear, fast, consistent, and polished. The UX benchmark discussed during the project was “Apple-like quality”, not in the sense of copying Apple visually, but in terms of clarity, hierarchy, simplicity and attention to detail.

---

## 4. Key product principles already agreed

These are not suggestions. Treat them as binding until explicitly changed by Mateusz.

### 4.1 Forecast before actuals

In the entire application, **forecast is always shown before actual realization**.

Order:

1. Forecast / Prognoza
2. Actual / Realizacja
3. Variance / Odchylenie
4. Explanation / Wnioski

This applies to revenue, costs, cash position, occupancy, result and dashboards.

### 4.2 Company cash position matters more than apartment monthly balance

Do not design monthly cash balance as a primary KPI for a single apartment.

Reason: payments to owners may be monthly, quarterly, yearly or irregular, so a single apartment's monthly balance may be misleading.

Monthly cash position belongs to the company-level financial view, currently similar to the existing “Saldo firmowe” module.

### 4.3 Apartment is a business unit

An apartment is not just a property record. It is a business unit / investment unit that aggregates:

- revenue,
- costs,
- forecast,
- actuals,
- contracts,
- payments,
- partner relationship,
- decisions.

### 4.4 Partner instead of only Owner

The system should prefer the broader business term **Partner** over “Owner” when modeling long-term architecture.

Reason: today the partner is usually an apartment owner, but in the future it could be an investor, company, fund, or other business entity.

### 4.5 Relationship timeline, not only apartment timeline

The history of cooperation belongs primarily to the **business relationship** between Partner and the company, often connected through contracts and annexes.

An apartment card can show “Relacja od…” / “Relationship since…”, but clicking it should open the broader cooperation timeline.

Timeline examples:

- first contract signed,
- annex signed,
- rent changed,
- additional apartment added,
- contract extended,
- cooperation ended.

The timeline should ideally be document-driven: contract PDFs, annexes and other documents should create timeline events.

### 4.6 Contracts are forecast as continuing unless user ends relationship

Even if a contract has a formal end date, forecasts should usually continue beyond that date until Mateusz explicitly decides to stop working with that apartment / partner.

Business reason: historically, since 2010, owners have not typically terminated cooperation; Mateusz decides when to continue or end collaboration.

### 4.7 One source of truth

Each business value must have one place where it is edited.

Examples:

- rent amount → contract,
- owner/partner bank account → partner,
- forecast → forecast module,
- payment schedule → payment engine,
- Hotres mapping → apartment integration configuration.

Other screens display summaries and navigation, not duplicate editable fields.

### 4.8 AI assists; business rules decide

AI should not be treated as the source of truth.

AI should:

- explain data,
- suggest actions,
- summarize consequences,
- help discover anomalies.

Business rules and system calculations should:

- calculate forecasts,
- create payment schedules,
- update cash position,
- determine statuses.

### 4.9 Every main screen supports a decision

Every screen should answer a clear business question.

Example for Apartment Center:

- Is this apartment performing according to forecast?
- Are costs under control?
- Are there overdue or upcoming payments?
- Do I need to make a decision today?

### 4.10 Summary on main screen; full detail one click deeper

If a dedicated center exists, the main card should show only summary and a link.

Examples:

- Apartment card shows payment preview + link to full Payment Center.
- Apartment card shows cost table summary + click into Cost Center/category.
- Apartment card shows relationship since date + link to relationship timeline.

---

## 5. Business models

The company works with several cooperation models.

### 5.1 Guaranteed rent model / najem gwarantowany

The company pays the owner a guaranteed amount according to contract terms and keeps the upside from rental performance.

This model creates stronger fixed obligations and higher risk, but potentially higher profit.

The system must automatically create:

- contractual obligations,
- forecasted costs,
- payment schedule,
- cashflow impact,
- apartment-level and company-level forecast impact.

### 5.2 Commission model / model prowizyjny

The company manages apartment sales/operation for commission. Lower fixed risk, lower upside.

This model should be supported because the long-term strategy may include having an optimal number of guaranteed apartments and then adding more commission-based units.

### 5.3 Hybrid model

Combination of fixed guaranteed component and commission/revenue-sharing component.

The system must support mixed rules and clearly show which part creates fixed obligation and which part depends on revenue.

### 5.4 Sublease / podnajem

Podnajem is a distinct revenue stream. It must be separated from short-term rental revenue in reporting.

For revenue tables and charts:

- forecast,
- short-term rental,
- sublease,
- total,
- variance.

---

## 6. Forecasting philosophy

Forecasting is the core of Bałtyckie OS.

The system is not just historical reporting. It should help Mateusz manage future cash position and portfolio risk.

### 6.1 Forecast methods

The user needs options for how forecasts are created:

- manual forecast,
- average from last 12 months,
- seasonal average,
- contract-derived forecast,
- future AI-assisted forecast.

### 6.2 Forecast applies to both revenue and costs

Revenue forecasts and cost forecasts are equally important for company cash position.

### 6.3 Unknown cost values

Some costs are known from contracts. Some costs are not known in advance and should be forecast from history.

Examples of historically based costs:

- PIT,
- VAT,
- cleaning chemicals,
- BHP supplies,
- operational expenses.

### 6.4 Apartment revenue forecast

When adding a new apartment and contract, the system should immediately support creating revenue forecast for that apartment.

This is necessary because company cash position depends on both cost and revenue forecasts.

---

## 7. Apartment Center 2.0 – agreed direction

Apartment Center 2.0 is the reference UX pattern for the whole application.

It should not be a simple data card. It should be the management center for one apartment as a business unit.

### 7.1 Main desktop sections

Agreed high-level layout:

1. Hero / identity section
2. Yearly CEO Summary
3. Monthly revenue performance
4. Cost table
5. Payment preview
6. Relationship timeline preview
7. Quick actions

AI should be contextual rather than a large separate chatbot panel.

### 7.2 Hero section

Hero should be a clean identification card, not overloaded with financial KPIs.

Should include:

- apartment name,
- location, e.g. Bulwar Portowy,
- full address, e.g. Bulwar Portowy 7/14,
- operational status,
- partner name as link to Partner Center,
- relationship since date as link to timeline,
- cooperation model,
- possibly data health indicator.

Surface area / metraż is not needed in the main hero.

Photo may stay small for visual identification, but it should not dominate. Mateusz does not need a large apartment image for daily management.

### 7.3 CEO Summary

This is annual, not monthly.

The apartment card should not focus on monthly profit/result because payment schedules can distort monthly apartment result.

CEO Summary should show annual/YTD perspective:

- revenue forecast,
- revenue actual,
- revenue variance,
- cost forecast,
- cost actual,
- cost variance,
- annual result forecast,
- annual result actual,
- annual variance.

### 7.4 Monthly revenue performance

This section is important.

For each month/year, user needs to see revenue realization and forecast.

Agreed chart idea:

- bar chart,
- left bar = forecast,
- right bar = actual total,
- actual total is stacked into short-term rental and sublease colors.

Need ability to switch years:

- previous years to inspect past forecast realization,
- current year,
- future years to inspect forecasts.

Table order should respect forecast-first principle.

Recommended monthly table columns:

- Month,
- Forecast,
- Short-term rental,
- Sublease,
- Total actual,
- Variance.

No monthly apartment result as primary KPI.

### 7.5 Costs

Costs are one of the most important pieces of information on apartment card and must be visible immediately.

Do NOT hide costs behind only a summary. Mateusz needs a table.

Cost table should include at least:

- category,
- source,
- forecast,
- actual,
- PLN variance,
- percentage variance,
- status.

Do NOT include next payment in cost table because payment preview exists separately.

Cost categories should reflect the categories already used in current e-Bałtyckie 2.0. Claude should inspect the existing app/code/data to determine current categories before finalizing the table.

### 7.6 Payment preview

Apartment card should show payment preview, not full payment module.

Include:

- overdue payments strongly highlighted,
- upcoming key payments,
- CTA/link to full payment schedule/history,
- button “Generuj przelewy” / generate transfers.

Overdue payments must be visually prominent.

### 7.7 Quick actions

Actions on apartment card should match real business actions, not generic PMS actions.

Do NOT prioritize “add reservation”.

Preferred actions:

- Dodaj umowę,
- Dodaj aneks,
- Dodaj podnajem,
- Dodaj koszt,
- Wygeneruj przelewy,
- Zarządzaj.

Also needed somewhere in management/configuration:

- create/edit forecast,
- set Hotres apartment name/ID mapping,
- manage cost rules,
- add/edit contractual costs,
- generate contract or annex from template.

These may be under a “Zarządzaj” panel rather than cluttering main hero.

### 7.8 Responsiveness

Desktop, tablet and mobile should not be simple scaled versions of the same screen.

Desktop: analytical, more data at once.  
Tablet: operational, larger controls, collapsible sections.  
Mobile: decision summary, alerts, key KPIs and main actions.

---

## 8. UI / UX philosophy

### 8.1 Premium quality

Application should feel coherent and refined. Avoid typical admin-panel clutter.

Quality references discussed:

- Apple for calm hierarchy and polish,
- Linear for speed and clarity,
- Stripe Dashboard for financial clarity,
- Notion for readability.

Do not copy these products. Use them as quality benchmarks.

### 8.2 Business calm

The interface should create a feeling of control.

Avoid:

- noisy dashboards,
- excessive red alerts,
- too many buttons,
- inconsistent cards,
- overloaded tables.

Use strong visual alerts only where Mateusz must act.

### 8.3 Decision hierarchy

For each screen, decide what question it answers.

Example Apartment Center questions:

1. Does this apartment perform according to forecast?
2. Are costs under control?
3. Are there payments I must handle?
4. Does cooperation require action?

---

## 9. Payment and cost automation

A major objective is to reduce manual work.

### 9.1 Contract creates obligations

When a contract is added, the system should generate:

- payment obligations,
- cost forecast,
- payment schedule,
- cash position impact,
- tasks for setup.

### 9.2 One contract can cover multiple apartments

Important real-world case:

A single contract with one partner can cover several apartments.

Costs may be:

- assigned to one apartment,
- divided equally among apartments,
- divided by custom shares,
- allocated by user-defined rules.

This must be supported in the data model and contract wizard.

### 9.3 Payment generation

The “Generuj przelewy” idea is important. The system should eventually help generate payment batches for daily payment work.

---

## 10. Existing integrations and systems

### 10.1 Replit

Current copied app in Replit is called approximately **e-Bałtyckie 2.0**.

Known Replit ID from previous tool usage:

`e3f82f29-6a0b-4367-bc15-2f233058962b`

Replit should be used for running/previewing app and possibly UI implementation, but not as the only product decision maker.

### 10.2 GitHub

Repository:

`MatiC1987/baltyckie-os`

Already created files include:

- `blueprint/README.md`
- `blueprint/000_Vision.md`
- `blueprint/001_Product_Principles.md`
- `blueprint/002_Business_Model.md`
- `blueprint/003_Business_Dictionary.md`
- `blueprint/processes/BP-001_Pozyskanie_Partnera_i_Podpisanie_Umowy.md`
- `blueprint/processes/BP-002_Dodanie_Apartamentu.md`

These files are early drafts. Treat them as starting material, not complete truth.

### 10.3 Hotres

Hotres is a key system. Bałtyckie OS should integrate with Hotres where possible.

Apartment configuration should support mapping an apartment to Hotres.

Data that should eventually come from Hotres/API rather than manual entry:

- reservations,
- short-term rental revenue,
- occupancy,
- operational sales data.

The current app already has some Hotres-related logic/modules. Claude must inspect current code before designing final integration.

---

## 11. Current state and known issue in collaboration

Important context for Claude:

The previous ChatGPT collaboration became inefficient because too much time was spent on process discussion and not enough on deliverables. Mateusz became frustrated, correctly, because the work appeared to loop between planning, re-planning and role definitions.

Claude should avoid this.

Required behavior for Claude:

- Work directly in the repository.
- Prefer concrete commits over long explanations.
- Do not introduce new frameworks/processes unless necessary.
- When proposing architecture, also create or update actual files.
- Keep Mateusz informed briefly and concretely.

---

## 12. Recommended Claude Code first task

Before implementing new product features, Claude should do a repo audit.

Task:

1. Read the full repository.
2. Identify current frontend/backend architecture.
3. Locate existing apartment, owner/partner, cost, forecast, payment and dashboard modules.
4. Compare current implementation with this handover and Blueprint drafts.
5. Create a concise report: `claude_audit/REPO_AUDIT_001.md`.
6. Do not change product behavior yet.

Then propose the smallest next implementation step.

---

## 13. Recommended development workflow from now on

1. Inspect current module in code.
2. Check Blueprint / handover rules.
3. Create or update a specification under `/specifications`.
4. Implement a small vertical slice.
5. Create commit/PR.
6. Review against product principles.
7. Only then move to next slice.

Do not implement large vague prompts like “make apartment card better”.

Use small task IDs, for example:

- AC-001 Apartment Hero
- AC-002 Annual CEO Summary
- AC-003 Monthly Revenue Performance
- AC-004 Cost Table
- AC-005 Payment Preview
- AC-006 Relationship Timeline Preview
- AC-007 Responsive Layout

---

## 14. Things not to do

Do not:

- show actuals before forecasts,
- make apartment monthly result a primary KPI,
- hide apartment costs behind only a summary,
- make photo dominate the apartment card,
- treat contract end date as automatic end of forecast,
- duplicate editable values across modules,
- build UI without inspecting existing e-Bałtyckie 2.0 functionality,
- add generic PMS actions that do not match Mateusz's workflow,
- rely on AI as the calculation source of truth,
- flood the user with process explanations instead of shipped work.

---

## 15. Roadmap priority

Immediate priority is not a large rewrite.

Recommended order:

1. Repo audit.
2. Normalize documentation around this handover.
3. Inspect existing Apartment module.
4. Create `specifications/AC-000_Apartment_Center_2.0.md`.
5. Implement Apartment Center in small vertical slices.
6. Review with Mateusz.
7. Only then proceed to Partner / Contract / Forecast / Payment centers.

Apartment Center remains the reference UI/UX pattern, but it should be driven by business rules and existing code reality, not imagined in isolation.

---

## 16. Final instruction to Claude Code

You are not only writing code. You are helping transform a real business process into a maintainable internal operating system.

Be practical. Preserve existing value. Avoid over-engineering. Work in small commits. Keep the product vision intact.

When uncertain, mark the decision as requiring Mateusz approval instead of guessing.
---
name: Cennik module architecture
description: Tabele DB, routes i komponenty UI modułu cennika (pricing management)
---

## Tabele DB (wszystkie tworzone przez migrate-pricing-tables.ts + migrate-ai-pricing.ts)

- `daily_prices` — ceny dzienne per apartament, UNIQUE(apartment_id, date), source: manual/rule/copy/template/derived/hotres/ai-auto
- `pricing_rules` — reguły cenowe (sezon/weekend/lastminute), z modifier_type (percent/fixed)
- `price_change_history` — log zmian cen, batch_id dla masowych zmian
- `pricing_alerts` — alerty zdrowia cennika
- `holidays` — święta i ważne daty
- `price_templates` — szablony cenowe (JSON config)
- `apartment_pricing_config` — konfiguracja pochodnych cen per apartament
- `ai_recommendations` — rekomendacje AI (GPT-4o mini), status: pending/applied/dismissed
- `ai_pricing_config` — konfiguracja AI per apartament (UNIQUE apartment_id), auto_mode, max_change_percent, min/max price

## Routes (server/routes.ts, sekcja ~15218+)

Wszystkie routes używają `pgPool.query()`. Kluczowe:
- `GET/POST /api/pricing/daily` — pobieranie/upsert cen dziennych
- `POST /api/pricing/daily/batch` — masowy upsert
- `POST /api/pricing/daily/copy` — kopiowanie między apartamentami
- `GET/POST/PUT/DELETE /api/pricing/rules` + `/apply` — reguły cenowe
- `GET/POST/PUT/DELETE /api/pricing/templates` + `/apply` — szablony
- `GET/PUT /api/pricing/config/:apartmentId` — konfiguracja pochodnych
- `POST /api/pricing/derived/apply` — zastosuj ceny pochodne (mnożnik + offset)
- `GET /api/pricing/hotres/pull`, `POST /api/pricing/hotres/push` — synchronizacja HotRes
- `GET/POST/DELETE /api/pricing/holidays` — święta
- `GET /api/pricing/history` — historia zmian z paginacją
- `GET/PUT /api/pricing/ai/config/:apartmentId` — konfiguracja AI
- `GET /api/pricing/ai/recommendations` — lista rekomendacji
- `POST /api/pricing/ai/recommend` — generuj nowe (GPT-4o mini)
- `POST /api/pricing/ai/recommendations/:id/apply|dismiss` — akcje
- `POST /api/pricing/ai/recommendations/apply-batch` — masowe zastosowanie

## Frontend (client/src/pages/Cennik.tsx)

- Route: `/cennik` w App.tsx
- Sidebar: DEFAULT_ITEMS + DEFAULT_SECTIONS["rezerwacje"] w sidebar-config.ts
- 6 zakładek: Kalendarz (CalendarTab), Reguły (RulesTab), Szablony (TemplatesTab), HotRes (HotresTab), Historia (HistoryTab), AI (AiTab)
- CalendarTab: siatka miesięczna/roczna, heatmap kolorów (zielony→czerwony wg ceny), edycja komórek, bulk edit, tryb kopiowania
- AiTab: generator rekomendacji, lista z filtrem status/apartament, apply/dismiss per rekord i batch, dialog konfiguracji AI

**Why:** Moduł zarządzania cenami dla właścicieli apartamentów — integruje ręczne ustawianie cen, reguły automatyczne i rekomendacje AI.

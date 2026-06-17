---
name: HotRes API sync fix
description: Poprawna konfiguracja synchronizacji HotRes API — parametry, format, formuła cenowa, paginacja Deep Sync
---

## Poprawny parametr dla regularnego syncu
`mod_date` (format: `Y-m-d H:i:s`, np. `2026-03-18 00:00:00`)
- Regularna synchronizacja: 90 dni wstecz, co 60 minut
- URL: `&mod_date=${encodeURIComponent(modDateStr)}`

## Formuła cenowa (API list endpoint)
- `total` = pełna wartość rezerwacji (nocleg + addony)
- `addons_amount` = wszystkie dodatki (sprzątanie + podatek miejski + upsell)
- `price` w DB = total, `surcharge` = addons_amount

## Paginacja Deep Sync — DEFINITYWNA DIAGNOZA (wyczerpane wszystkie opcje)

### WSZYSTKIE przetestowane parametry są IGNOROWANE przez HotRes:
- `page=1, 2, 3...` — ignorowany (zwraca te same rekordy)
- `from=YYYY-MM-DD&till=YYYY-MM-DD` — ignorowany (78 testów miesiąc-po-miesiącu, każdy = te same 9 rez.)
- `departure_date=YYYY-MM-DD` — ignorowany
- `number=X` — ignorowany (test: `?number=9222` zwrócił te same 300 rez. co bez filtru)

### JEDYNY działający parametr: `mod_date`
- Bez `mod_date`: zwraca ~9 najnowszych rez.
- Z `mod_date=2020-01-01 00:00:00`: zwraca 300 najnowiej **zmodyfikowanych** rez. (DESC sort)
- Limit 300 jest twardy i niepomijalny przez API

**Why:** HotRes `api_reservations` to prosty endpoint z jednym filtrem mod_date. Brak mechanizmu paginacji po stronie serwera. Żadne dodatkowe parametry GET nie są rozpoznawane.

### Aktualna strategia Deep Sync (v5 — finalna):
- Wywołuje `mod_date=2020-01-01` → przetwarza 300 najnowiej zmodyfikowanych rez.
- Informuje użytkownika żeby użył "Napraw ceny (fallback)" przez CSV dla pełnej historii
- Test `number=` przeprowadzany przy każdym uruchomieniu (2 API calle diagnostyczne) — wynik w logu

### Dla pełnej historii (wszystkie ~2762 rez.): użyj CSV import + "Napraw ceny (fallback)"

## CSV import
- CSV `amount` = nocleg only
- Dla istniejących rez: NIE nadpisuj price/surcharge (mogą mieć poprawne z API)
- Dla nowych: price = CSV.amount + apartment.cleaningFee (jeśli ustawione)

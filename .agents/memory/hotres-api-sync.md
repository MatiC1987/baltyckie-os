---
name: HotRes API sync fix
description: Poprawna konfiguracja synchronizacji HotRes API — parametry, format, formuła cenowa
---

## Problem
Sync HotRes API zawsze zwracał 0 wyników bo kod używał `&from=YYYY-MM-DD`, który nie istnieje w API.

## Poprawny parametr
`mod_date` (format: `Y-m-d H:i:s`, np. `2026-03-18 00:00:00`)
- Domyślna wartość: -2 godziny od teraz
- Regularna synchronizacja: 90 dni wstecz
- URL: `&mod_date=${encodeURIComponent(modDateStr)}`

**Why:** Dokumentacja API HotRes (api_reservations) wymienia `mod_date`, nie `from`. Nieznane parametry są ignorowane przez serwer HotRes.

## Formuła cenowa (API list endpoint)
- `total` = cena noclegu (accommodation only)
- `addons_amount` = wszystkie dodatki (sprzątanie + podatek miejski + upsell)
- `price` w DB = total + addons_amount
- `surcharge` w DB = addons_amount

**Uwaga:** W `api_reservationdetails` (single endpoint) `total` = PEŁNA suma (nocleg + addons). Inne semantyki niż list!

## Paginacja (deep sync)
- Endpoint limit: 300 wyników per call
- Parametr do paginacji: `mod_date` (format: `Y-m-d H:i:s`, np. `2020-01-01 00:00:00`)
- `departure_date` NIE działa jako filtr paginacji — zwraca tylko ~8 wyników zamiast ~2474
- Strategia: startuj od `2020-01-01 00:00:00`, posuń do max `mod_date` (pole `mod_date` lub `updated_at`) z każdej strony
- Zabezpieczenia: max 40 iteracji, Set<string> deduplikacja, brak postępu = stop
- Endpoint: POST /api/hotres/deep-sync

## CSV import
- CSV `amount` = nocleg only (jak `total` z API)
- Dla istniejących rezerwacji: NIE nadpisuj price/surcharge (mogą mieć poprawne z API)
- Dla nowych: price = CSV.amount + apartment.cleaningFee (jeśli ustawione)

## Harmonogram auto-sync
- Co 60 minut, 90 dni wstecz
- Limit 300/hour API rate limit

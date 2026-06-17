---
name: HotRes API sync fix
description: Poprawna konfiguracja synchronizacji HotRes API — parametry, format, formuła cenowa, paginacja Deep Sync
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

## Paginacja Deep Sync — WAŻNE
- Endpoint limit: 300 wyników per call
- `departure_date` NIE działa jako filtr — zwraca tylko ~8 wyników (ignorowany przez serwer)
- `mod_date` jako kursor NIE działa: HotRes zwraca 300 NAJNOWSZYCH rez. niezależnie od daty → max(mod_date) z page 1 = dziś → page 2 = 0 wyników

### Aktualna strategia (v3): stały mod_date + page=X
```
URL: mod_date=2020-01-01 00:00:00 + &page=1, &page=2, &page=3...
```
- Jeśli `page=` jest obsługiwany przez HotRes → pobiera wszystkie strony historyczne
- Jeśli `page=` jest ignorowany (page 2 zwraca te same rekordy co page 1) → wykrywa brak postępu i informuje użytkownika aby użył importu CSV
- Każda strona loguje minimalny i maksymalny mod_date dla diagnostyki

**Why:** mod_date cursor zwraca 300 newest records (desc), więc cursor advancement nie daje dostępu do starszych rekordów. Page-based pagination omija ten problem jeśli HotRes to obsługuje.

## CSV import
- CSV `amount` = nocleg only (jak `total` z API)
- Dla istniejących rezerwacji: NIE nadpisuj price/surcharge (mogą mieć poprawne z API)
- Dla nowych: price = CSV.amount + apartment.cleaningFee (jeśli ustawione)

## Harmonogram auto-sync
- Co 60 minut, 90 dni wstecz
- Limit 300/hour API rate limit

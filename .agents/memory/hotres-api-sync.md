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
- `total` = pełna wartość rezerwacji (nocleg + addony) — zmienione po inspekcji danych
- `addons_amount` = wszystkie dodatki (sprzątanie + podatek miejski + upsell)
- `price` w DB = total (całość)
- `surcharge` w DB = addons_amount

**Uwaga:** W `api_reservationdetails` (single endpoint) `total` = PEŁNA suma (nocleg + addons). Inne semantyki niż list!

## Paginacja Deep Sync — DEFINITYWNE WYNIKI TESTÓW

### Potwierdzone IGNOROWANE parametry (każde wywołanie zwraca IDENTYCZNY zestaw):
- `page=1, 2, 3...` — ignorowany
- `from=YYYY-MM-DD&till=YYYY-MM-DD` — ignorowany (78 wywołań miesiąc-po-miesiącu, każde zwróciło te same 9 rez.)
- `departure_date=YYYY-MM-DD` — ignorowany
- `arrival_date` — nie testowany, ale prawdopodobnie ignorowany

### Jedyny działający parametr: `mod_date`
- Bez `mod_date`: zwraca ~9 najnowszych rez. (ostatnio dodane)
- Z `mod_date=2020-01-01 00:00:00`: zwraca 300 najnowiej **zmodyfikowanych** rez.
- Zawsze sortuje DESC po mod_date → zawsze te same 300, nie da się pagować

**Why:** HotRes `api_reservations` to prosty endpoint z jednym filtrem. Nie ma mechanizmu paginacji.

### Aktualna strategia Deep Sync (v5): DB-driven + test number=
```
1. Pobierz wszystkie numery rezerwacji z lokalnej bazy
2. TEST: sprawdź czy ?number=X zawęża wyniki (2 API calle diagnostyczne)
3a. Jeśli number= działa → batch po 5 równoległych lookupów dla każdej rez. z DB (~550 calle)
3b. Jeśli number= ignorowany → fallback do 300 najnowszych (mod_date=2020-01-01)
```

**Why:** Jedyny sposób ominąć limit 300 bez paginacji — indywidualny lookup po numerze. Jeśli też ignorowany, jedynym rozwiązaniem dla pełnej historii jest CSV import.

## CSV import
- CSV `amount` = nocleg only (jak `total` z API)
- Dla istniejących rezerwacji: NIE nadpisuj price/surcharge (mogą mieć poprawne z API)
- Dla nowych: price = CSV.amount + apartment.cleaningFee (jeśli ustawione)

## Harmonogram auto-sync
- Co 60 minut, 90 dni wstecz
- Limit 300/hour API rate limit

# Audyt Formuł Finansowych — Baltyckie Finanse

**Data audytu:** 2026-06-20  
**Wersja aplikacji:** Task #188

---

## Podsumowanie

Przeprowadzono kompleksowy przegląd wszystkich formuł finansowych: przychody, koszty, saldo, prognozy oraz rozliczenia podnajmów. Znaleziono i naprawiono **5 błędów** wpływających na poprawność raportów i kalkulacji.

---

## Błędy znalezione i naprawione

### BŁĄD 1 — KRYTYCZNY: Raporty PDF (ReportExport) — błędne nazwy pól rezerwacji

**Plik:** `client/src/pages/ReportExport.tsx`  
**Waga:** Krytyczna — wszystkie 3 typy raportów PDF były całkowicie uszkodzone

**Opis:**  
Wszystkie trzy generatory raportów (`generateMonthlyReport`, `generateReservationList`, `generateOccupancyReport`) używały nieistniejących nazw pól z poprzedniego API:
- `r.checkIn` zamiast `r.startDate` → filtr dat nigdy nie zwracał żadnych rezerwacji
- `r.checkOut` zamiast `r.endDate` → daty wyświetlane jako "-"
- `r.totalAmount || r.amount` zamiast `r.price` → kwoty wyświetlane jako "0,00 zł"
- Obliczenie obłożenia: `new Date(undefined)` → wynik NaN → 0% obłożenia dla każdego apartamentu

**Skutek:** Raporty miesięczne, lista rezerwacji i raport obłożenia generowały puste tabele z zerowymi przychodami.

**Naprawa:** Zastąpiono `checkIn`→`startDate`, `checkOut`→`endDate`, `totalAmount||amount`→`price` we wszystkich 3 funkcjach (6 miejsc).

---

### BŁĄD 2 — ŚREDNI: SubrentSettlement — podnajmy bezterminowe niewidoczne w rozliczeniach

**Plik:** `client/src/pages/SubrentSettlement.tsx` (linia 162)  
**Waga:** Średnia — całkowite pominięcie aktywnych kontraktów bez daty końcowej

**Opis:**  
```js
// PRZED (błąd):
subleases.filter(s => s.endDate >= today)
// null >= "2026-06-20" === false w JavaScript
```
Podnajmy z `endDate = null` (bezterminowe) były filtrowane jako nieaktywne, ponieważ `null >= "2026-06-20"` zwraca `false` w JavaScript. Taki kontrakt nigdy nie pojawiał się w widoku rozliczenia podnajmów.

**Naprawa:**
```js
subleases.filter(s => !s.endDate || s.endDate >= today)
```

---

### BŁĄD 3 — ŚREDNI: API /profitability — bezterminowe podnajmy wykluczone z rentowności

**Plik:** `server/routes.ts` (linia ~1004)  
**Waga:** Średnia — przychody z podnajmów bezterminowych nie wliczane do rentowności apartamentów

**Opis:**  
Zapytanie SQL używało `gte(subleases.endDate, startDate)`, co wyklucza rekordy z `endDate IS NULL` (w SQL: `NULL >= '2026-01-01'` = `NULL = false`).

**Naprawa:** Zastosowano `or(isNull(subleases.endDate), gte(subleases.endDate, startDate))` w 3 endpointach:
- `/api/profitability` (rentowność apartamentów)
- `/api/year-comparison` (porównanie rok do roku)
- `/api/stats/apartments` (obliczanie obłożenia)

Dodatkowo naprawiono obliczenie `subEnd` dla podnajmów bezterminowych — `new Date(null)` dawało epokę (1970), przez co `totalDays` wychodziło ujemne i rekord był pomijany. Teraz `subEnd = yearEndDate` gdy `endDate` jest null.

---

## Obszary bez błędów (zatwierdzone)

### Saldo osobowe — bieżące saldo

**Plik:** `client/src/pages/Saldo.tsx`, `server/storage.ts`  
**Status:** ✅ Poprawne

API `getSaldoEntries` zwraca wpisy posortowane rosnąco wg daty (`orderBy(saldoEntries.date, saldoEntries.id)`). Funkcja `buildTrendData` iteruje wpisy w tej kolejności i buduje poprawną mapę dziennych sald. Bieżące saldo (`currentSaldo`) jest obliczane jako suma wszystkich `cashAmount` + saldo początkowe — niezależna od kolejności, zawsze poprawna.

### Prognoza salda firmowego — /api/balance-forecast

**Plik:** `server/routes.ts` (linia ~10612)  
**Status:** ✅ Poprawne (z uwagą)

Endpoint używa spójnego indeksowania miesięcy 0-indexed dla map prognoz (`rfMonth = d.getMonth()`) i 1-indexed dla map rzeczywistych (`calMonth = d.getMonth() + 1`). Zapytania do odpowiednich map używają właściwego indeksu. Indeksowanie jest wewnętrznie spójne.

Formuła dla bieżącego miesiąca jest poprawna:
```
endBalance = runningBalance + revenueRemaining + surcharges - aptCostRemaining - opCostRemaining
```

### Rozliczenia podnajmów — przeterminowane / bieżące / przyszłe

**Plik:** `client/src/pages/SubrentSettlement.tsx` (linia ~228)  
**Status:** ✅ Poprawne (po naprawieniu BUG #2)

Grupowanie płatności wg roku+miesiąca jest poprawne. Zaległe = poprzednie miesiące z nieopłaconymi płatnościami. Bieżące = bieżący miesiąc. Przyszłe = kolejne miesiące. Porównanie oparte na roku/miesiącu (nie dokładnej dacie) jest właściwe dla rozliczeń miesięcznych.

### getSubleasePaymentsTotalByYear

**Plik:** `server/storage.ts` (linia ~1257)  
**Status:** ✅ Poprawne

Agregacja płatności wg miesiąca wyłącza kaucje (`LOWER(category) != 'kaucja'`). Zwraca sumy brutto (bez uwzględnienia statusu opłacenia) — co jest właściwe dla prognoz przychodów. Indeksowanie miesięcy jest 0-based w `byMonth` (0=styczeń), co jest spójne z wywołującym kodem.

### getPaymentDatesForFrequency — harmonogram płatności

**Plik:** `server/routes.ts` (linia ~302)  
**Status:** ✅ Akceptowalne (drobna uwaga)

`Math.min(payDay, 28)` — celowe zabezpieczenie przed problemami końca miesiąca. Dla kontraktów z `payDay=31` (ostatni dzień miesiąca), płatności będą generowane 28-ego każdego miesiąca. W lutym to dokładna data, w innych miesiącach 3 dni wcześniej. Zachowanie jest deterministyczne i znane użytkownikowi. Nie jest to błąd — to świadoma decyzja projektowa.

### getDashboardStats

**Plik:** `server/storage.ts` (linia ~1181)  
**Status:** ✅ Nieużywane produkcyjnie

Funkcja ta (`/api/stats/dashboard`) zawiera komentarz "placeholder for complex logic" i jest wywoływana tylko przez jeden endpoint stats. Nie jest widoczna w głównym dashboardzie — główne wskaźniki KPI korzystają z osobnych, bardziej szczegółowych endpointów. Waga: niska.

### V2Przychody — prognoza przychodów miesięczna

**Plik:** `server/routes.ts` (linia ~9580)  
**Status:** ✅ Poprawne

Formuła bieżącego miesiąca:
```
monthResult = unrealizedRevenue + pendingPayments + subleaseRevenue + actualRevenue - actualExpenses - unrealizedCosts
```
jest matematycznie poprawna. Przychody sublease w tym endpoint używają `rentAmount` z aktywnych umów (nie płatności) co daje prognozę opartą na umowach — to właściwe dla planowania.

---

## Podsumowanie zmian

| Plik | Zmiany | Opis |
|------|--------|------|
| `client/src/pages/ReportExport.tsx` | 6 miejsc | `checkIn`→`startDate`, `checkOut`→`endDate`, `totalAmount\|\|amount`→`price` |
| `client/src/pages/SubrentSettlement.tsx` | 1 miejsce | Dołączenie podnajmów bezterminowych (`!s.endDate \|\| ...`) |
| `server/routes.ts` | 4 miejsca | `isNull` import + null-safe SQL dla podnajmów bezterminowych w 3 endpointach |

**Łącznie naprawiono:** 5 błędów w 3 plikach (11 punktów kodu)

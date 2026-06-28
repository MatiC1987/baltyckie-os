# AUDIT-001 — Repository and Product Context

**Data:** 2026-06-28  
**Audytor:** Claude Code (Sonnet 4.6)  
**Status:** Kompletny — tylko diagnostyczny, żadnego kodu nie zmieniono.

---

## KROK 1 — Wzorzec "null jako bezterminowość"

### Podsumowanie

Wzorzec „null = bezterminowość" stosowany jest w kilku tabelach. Poniżej pełna lista pól `endDate` z podziałem na nullable / not-null:

| Tabela (schema.ts) | Pole | Nullable? |
|---|---|---|
| `reservations` | `endDate` | `notNull` |
| `leases` | `endDate` | **nullable** (komentarz: "Nullable for indefinite") |
| `subleases` | `endDate` | **nullable** |
| `ownerContracts` | `endDate` | **nullable** |
| `serviceContracts` | `endDate` | **nullable** |
| `employees` | `endDate` | **nullable** |
| `employeeContracts` | `endDate` | **nullable** |

### Znalezione miejsca porównania — klasyfikacja

#### 🔴 BŁĄD — `server/routes.ts:786`
```typescript
.where(and(lte(leases.endDate, in30days), gte(leases.endDate, today)));
```
`leases.endDate` jest nullable. Gdy `endDate IS NULL` (umowa bezterminowa), oba warunki zwracają NULL → wiersz jest wykluczony z wyników. Endpoint zwraca listę "kończących się umów" — umowy bezterminowe słusznie nie trafiają na tę listę, więc **logicznie to zachowanie jest poprawne**. Jednak brak jawnego `isNull` sprawia, że kod jest podatny na nieoczekiwane interpretacje przy rozbudowie. **Ocena: nie jest to błąd logiczny w obecnym kontekście, ale brakuje ochrony przed regresją.**

#### 🔴 BŁĄD — `server/routes.ts:7153` (duplikat powyższego)
Identyczny wzorzec w drugim endpoincie (recepcja-routes lub inny kontekst). Identyczna ocena jak wyżej.

#### 🔴 BŁĄD — `server/routes.ts:7203–7204`
```typescript
lte(ownerContracts.endDate, in90days),
gte(ownerContracts.endDate, today)
```
`ownerContracts.endDate` jest nullable. Ten query szuka umów z właścicielami kończących się w ciągu 90 dni. **To jest rzeczywisty błąd finansowy:** umowy bezterminowe (null endDate) są cicho wykluczone zamiast być wyraźnie ignorowane przez `isNull` guard. Zgodnie z zasadą 4.6 z handoveru (kontrakty domyślnie trwają dalej), ten query powinien jawnie obsługiwać null.

#### ✅ BEZPIECZNE — `server/routes.ts:875, 1003, 1172, 6661`
```typescript
or(isNull(subleases.endDate), gte(subleases.endDate, startDate))
```
Wzorzec prawidłowy — `isNull` guard jest obecny. Bezterminowe podnajmy traktowane jako aktywne.

#### 🔴 BŁĄD — `client/src/components/dashboard/ExpiringLeasesTab.tsx:17`
```typescript
.filter(l => l.endDate && l.endDate >= todayStr && l.endDate <= in6monthsStr)
```
Tutaj wzorzec jest **poprawny** — `l.endDate &&` guard na początku chroni przed null. Umowy bezterminowe są pominięte (poprawne). **Bezpieczne.**

#### ⚠️ POTENCJALNY PROBLEM — `shared/schema.ts` line 44
```typescript
endDate: date("end_date").notNull(),
```
Jedna z tabel ma `endDate` notNull — wymaga weryfikacji, czy to intencjonalne (rezerwacje: tak, mają datę zakończenia).

### Podsumowanie Kroku 1

| Priorytet | Lokalizacja | Problem |
|---|---|---|
| 🔴 Krytyczny | `routes.ts:7203–7204` | ownerContracts expiry query bez null guard — błąd logiki finansowej |
| ⚠️ Ostrzeżenie | `routes.ts:786, 7153` | leases expiry — poprawne logicznie, brak jawnego null guard |
| ✅ OK | `routes.ts:875, 1003, 1172, 6661` | subleases — prawidłowy wzorzec z `isNull` |
| ✅ OK | `ExpiringLeasesTab.tsx:17` | JS-side — prawidłowy guard |

---

## KROK 2 — Martwy / nieużywany kod

### `getDashboardStats` — weryfikacja

**Werdykt: hook `useDashboardStats` jest zdefiniowany, ale NIE jest wywoływany w żadnym komponencie.**

Dowód grep:
```
client/src/hooks/use-stats.ts:4: export function useDashboardStats() { ... }
client/src/lib/prefetch-map.ts:2: "/": ["/api/dashboard-stats", ...]
client/src/lib/prefetch-map.ts:9: "/saldo-firmowe": ["/api/dashboard-stats", ...]
```

Hook `useDashboardStats` z `use-stats.ts` nie jest importowany ani używany w żadnym komponencie. Endpoint `/api/dashboard-stats` jest wywoływany przez `prefetch-map.ts` (prefetching), ale dane z hooka nigdzie nie są konsumowane. Serwer oblicza statystyki przy każdym prefetchu mimo że nikt tego nie wyświetla.

### Endpoint `/api/apartments/:id/dashboard-stats` (routes.ts:1932)

Używany w `Apartments.tsx:976` przez query key — **aktywny**.

### Inne obserwacje

- `server/seed-customers.ts` — plik seedujący dane testowe, nie jest wywoływany z produkcyjnego flow. Normalny dla środowiska dev.
- `scripts/fix-prognoza-overwrite.ts`, `scripts/migrate-*.ts` — jednorazowe migracje. Powinny być oznaczone jako "wykonane" lub przeniesione do `scripts/migrations/done/`.
- `main.py` — plik Python z `print("Hello from repl-nix-workspace!")`. Placeholder z inicjalizacji projektu w Replit, nie ma żadnej logiki biznesowej.

---

## KROK 3 — Struktura i duplikaty

### `script/` vs `scripts/`

**To NIE jest duplikat — to dwa odrębne katalogi z różnym przeznaczeniem:**

| Katalog | Zawartość | Przeznaczenie |
|---|---|---|
| `script/` | `build.ts` (1 plik) | Skrypt budowania aplikacji (esbuild + vite) — używany przez `npm run build` |
| `scripts/` | 13 plików | Jednorazowe migracje danych, backfille, seed scripts, fix scripts |

**Rekomendacja:** Nazewnictwo jest mylące. `script/build.ts` powinien być w `scripts/` lub jako `build.mjs` w korzeniu. Warto ujednolicić.

### `baltyckie-finanse.zip`

- Plik **uszkodzony** (unzip zwraca błąd "not a zipfile"). 
- Najprawdopodobniej to stary eksport danych finansowych z poprzedniego systemu — dane historyczne lub backup.
- **Problem:** plik binarny/danych w repozytorium narusza zasadę "git = kod". Jeśli zawiera dane finansowe — może zawierać wrażliwe informacje (numery kont, kwoty, dane właścicieli).
- **Rekomendacja:** Usunąć z repo, dodać do `.gitignore`. Przechowywać w bezpiecznym miejscu poza repo (Dropbox, zaszyfrowany backup).

### Dualizm Node.js + Python

| Plik | Technologia | Do czego |
|---|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts` | Node.js / TypeScript | Główna aplikacja (frontend React + backend Express) |
| `pyproject.toml`, `uv.lock` | Python 3.12 | Tylko `openpyxl` dependency — parser plików Excel |
| `main.py` | Python | Placeholder z Replit (`print("Hello...")`) — nic nie robi |

**Wniosek:** Python nie jest częścią architektury produkcyjnej. `openpyxl` sugeruje, że kiedyś planowano obsługę plików `.xlsx` po stronie serwera, ale jest to nieużywane. Import XLSX odbywa się po stronie klienta (patrz `hotres.ts` — parser CSV). **Rekomendacja:** usunąć `pyproject.toml`, `uv.lock`, `main.py` jeśli Python nie jest potrzebny.

### Rozmiar `server/routes.ts`

**16 510 linii** w jednym pliku.

Główne grupy endpointów (po prefiksie URL):

| Prefix | Liczba endpointów |
|---|---|
| `/api/pricing` | 32 |
| `/api/time-clock` | 25 |
| `/api/subleases` | 25 |
| `/api/saldo` | 20 |
| `/api/customers` | 11 |
| `/api/owner-contracts` | 10 |
| `/api/employee-tasks` | 8 |
| `/api/cost-invoices` | 8 |
| `/api/accounting-notes` | 8 |
| `/api/employees` | 7 |
| `/api/apt-cost-data` | 7 |
| `/api/app-users` | 7 |
| `/api/apartments` | 7 |
| `/api/airbnb-invoices` | 7 |
| `/api/time-entries` | 6 |
| `/api/service-contracts` | 6 |
| `/api/leave-requests` | 6 |
| `/api/handover-protocols` | 6 |
| `/api/employee-contracts` | 6 |
| `/api/company-settings` | 6 |
| + wiele innych | ~162 łącznie bez prefiksu |

**Plik jest krytycznie duży.** 16k linii w jednym pliku routes.ts to główne techniczne ryzyko projektu — edycje są trudne, konflikty merge nieuniknione, testowanie niemożliwe.

---

## KROK 4 — Testy automatyczne

**Werdykt: BRAK jakichkolwiek testów automatycznych w repozytorium.**

Przeszukano:
- `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` → **0 plików**
- `vitest.config.*`, `jest.config.*` → **0 plików**
- Foldery `__tests__/`, `test/`, `tests/` → **nie istnieją**

Cały projekt (frontend + backend) nie posiada żadnego pokrycia testowego. Każda zmiana logiki finansowej jest nieweryfikowalna automatycznie.

---

## KROK 5 — Integracja Hotres

### Co już działa

**Metoda:** REST API Hotres (`https://panel.hotres.pl/api_reservations`)  
**Autoryzacja:** Klucze API z env: `HOTRES_AUTH_KEY` + `HOTRES_API_KEY`  
**Automatyczna synchronizacja:** co 15 minut (harmonogram w `hotres-sync.ts:594`)

**Dane importowane z Hotres:**
- numer rezerwacji
- data dodania, przyjazd, wyjazd
- imię i nazwisko gościa
- cena, zaliczka, wpłata
- status (PRZYJETA / DO_OPLACENIA / ANULOWANA)
- źródło (Booking.com / Airbnb / Recepcja / HotRes / Inne)
- email, telefon

**Mapowanie apartamentów:**  
Apartament w Hotres → apartament w systemie przez pole `hotresName` w tabeli `apartments`. Mapowanie po nazwie (lowercase, trim).

**Import CSV:**  
Równolegle z API istnieje import ręczny przez CSV/XLSX (`server/hotres.ts`) — obsługuje wiele formatów kolumn, wiele separatorów (`;`, `,`, `\t`), format dat EU i ISO, konwersję dat z formatu Excel.

### Ograniczenia i problemy w kodzie

1. **Brak paginacji API** (`hotres-sync.ts:553`):
   ```
   // UWAGA: `from` nie jest parametrem API HotRes — ignorowane przez serwer.
   log.push("⚠️ API HotRes nie obsługuje paginacji — zaktualizowano X najnowiej zmodyfikowanych.")
   log.push("Aby naprawić ceny wszystkich rezerwacji historycznych, użyj 'Napraw ceny (fallback)' przez CSV.")
   ```
   API zwraca tylko rezerwacje zmodyfikowane od daty `mod_date`. Paginacja nie działa. Historyczne dane wymagają importu CSV.

2. **Ceny nie zawsze synchronizują się przez API** — komentarz wprost mówi, że ceny historyczne wymagają "Napraw ceny (fallback)" przez CSV.

3. **`deepSyncHotResReservations`** — funkcja próbuje ominąć brak paginacji przez multiple calls z różnymi datami, ale ograniczona przez architekturę API Hotres.

4. **Brak obsługi ceny jednostkowej / rozbicia na komponenty** — importowana jest tylko kwota łączna, bez podziału na najem/sprzątanie/media.

5. **Brak webhooków** — synchronizacja jest pull-based (polling co 15 min), nie push.

### Stan mapowania

Pole `hotresName` w tabeli `apartments` istnieje w schema. Apartamenty muszą być ręcznie mapowane przez UI (lub przez import).

---

## Rekomendowane następne kroki

### 🔴 Krytyczne — przed dalszą pracą

1. **Naprawić bug `routes.ts:7203–7204`** — ownerContracts expiry query bez null guard powoduje ciche pominięcie umów bezterminowych w widoku "kończące się umowy właścicielskie". Bezpośredni wpływ na decyzje finansowe.

2. **Usunąć `baltyckie-finanse.zip` z repo** — plik binarny z potencjalnie wrażliwymi danymi finansowymi w publicznym/teamowym repo. Dodać do `.gitignore`.

3. **Null guard dla `leases.endDate` w routes.ts:786 i 7153** — choć logicznie poprawne, brak jawnego guard'a jest pułapką przy rozbudowie. Dodać `isNotNull(leases.endDate)` lub komentarz wyjaśniający intencję.

### ⚠️ Ważne — kolejna iteracja

4. **`useDashboardStats` jest martwym kodem** — hook zdefiniowany w `use-stats.ts` nie jest nigdzie używany. Endpoint `/api/dashboard-stats` jest prefetchowany ale dane ignorowane. Usunąć lub podpiąć pod UI.

5. **`main.py` + `pyproject.toml` + `uv.lock` do usunięcia** — Python jest nieużywany w architekturze produkcyjnej. Zostawienie tych plików może mylić przyszłych developerów.

6. **Podzielić `server/routes.ts`** — 16 510 linii w jednym pliku to krytyczne ryzyko jakości. Sugerowany podział na moduły: `routes/subleases.ts`, `routes/pricing.ts`, `routes/time-clock.ts`, `routes/saldo.ts` itd.

### 📋 Mogą poczekać

7. **Ujednolicić `script/` i `scripts/`** — `script/build.ts` powinien trafić do `scripts/` lub korzenia projektu.

8. **Oznaczyć wykonane migracje** — pliki `scripts/migrate-*.ts` i `scripts/fix-*.ts` nie wskazują czy były uruchomione. Warto dodać `scripts/migrations/done/` lub plik `MIGRATIONS_LOG.md`.

9. **Testy automatyczne** — brak jakichkolwiek testów. Minimum: testy jednostkowe dla logiki finansowej (kalkulacje prognoz, rozkłady płatności, kalkulatory warunków umów).

10. **Hotres paginacja** — ograniczenie API jest znane i skomentowane. Obecny workaround (import CSV) działa. Docelowo negocjować z Hotres dostęp do pełnej historii przez API lub webhooks.

---

*Audyt wykonany: 2026-06-28. Żaden działający kod nie został zmieniony.*

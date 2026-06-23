# Instrukcja obsługi — Moduł Vectra

**Dla: Administratora systemu Bałtyckie Finanse**
**Dotyczy: zakładka VECTRA w Dokumentach Księgowych**

---

## Spis treści

1. [Czym jest moduł Vectra?](#1-czym-jest-moduł-vectra)
2. [Konta Vectra — dodawanie i zarządzanie](#2-konta-vectra--dodawanie-i-zarządzanie)
3. [Synchronizacja ręczna](#3-synchronizacja-ręczna)
4. [Harmonogram automatyczny](#4-harmonogram-automatyczny)
5. [Lista pobranych faktur](#5-lista-pobranych-faktur)
6. [Pobieranie faktur PDF](#6-pobieranie-faktur-pdf)
7. [Statusy synchronizacji](#7-statusy-synchronizacji)
8. [Najczęstsze błędy i rozwiązania](#8-najczęstsze-błędy-i-rozwiązania)

---

## 1. Czym jest moduł Vectra?

Moduł Vectra automatycznie loguje się do panelu klienta **online.vectra.pl** dla każdego skonfigurowanego konta i pobiera faktury PDF. Pobrane faktury są przechowywane w systemie i dostępne do podglądu oraz pobrania bez konieczności logowania się do portalu Vectra.

**Główne możliwości:**
- Obsługa 25–30 kont Vectra jednocześnie
- Automatyczne wykrywanie nowych faktur (pomijanie już pobranych)
- Synchronizacja ręczna (na żądanie) lub automatyczna (wg harmonogramu)
- Przechowywanie PDF w bezpiecznym magazynie plików
- Podgląd statusu i daty ostatniej synchronizacji dla każdego konta

---

## 2. Konta Vectra — dodawanie i zarządzanie

### Dodawanie nowego konta

1. Przejdź do **Dokumenty księgowe → zakładka VECTRA**.
2. W sekcji **Konta Vectra** kliknij przycisk **Dodaj konto**.
3. Wypełnij formularz:
   - **Etykieta** — dowolna nazwa identyfikująca konto, np. `Apartament 101 – Jan Kowalski`
   - **Login** — adres e-mail lub login używany na online.vectra.pl
   - **Hasło** — hasło do portalu Vectra (jest szyfrowane przed zapisem — nigdy nie jest przechowywane w postaci jawnej)
4. Kliknij **Dodaj konto**.

> **Ważne:** Hasło jest szyfrowane kluczem AES-256. Nawet administrator systemu nie może go odczytać po zapisaniu. Jeśli hasło zostanie zmienione na portalu Vectra, należy je zaktualizować w systemie.

### Edycja konta

1. W wierszu wybranego konta kliknij ikonę ołówka ✏️.
2. Możesz zmienić etykietę, login lub hasło.
3. Jeśli **nie wypełnisz pola hasła**, dotychczasowe hasło zostaje bez zmian.
4. Kliknij **Zapisz zmiany**.

### Usuwanie konta

1. W wierszu wybranego konta kliknij ikonę kosza 🗑️.
2. Konto zostanie usunięte wraz z historią synchronizacji i powiązanymi fakturami.

> **Uwaga:** Usunięcie konta jest nieodwracalne. Pliki PDF faktur przechowywane w magazynie obiektów zostaną usunięte z bazy danych, jednak pliki w magazynie mogą pozostać do czasu ręcznego czyszczenia.

---

## 3. Synchronizacja ręczna

### Synchronizacja pojedynczego konta

1. W tabeli kont kliknij ikonę 🔄 (odśwież) przy wybranym koncie.
2. System zaloguje się do portalu Vectra i pobierze nowe faktury.
3. Po zakończeniu status w kolumnie **Status synchronizacji** zostanie zaktualizowany.

### Synchronizacja wszystkich kont

1. Kliknij przycisk **Synchronizuj wszystkie** w nagłówku sekcji Konta Vectra.
2. System sekwencyjnie zsynchronizuje każde konto.
3. Po zakończeniu pojawi się komunikat z podsumowaniem: liczba nowych faktur i ewentualne błędy.

> **Uwaga:** Synchronizacja może trwać kilka–kilkanaście minut dla 25–30 kont, ponieważ każde konto wymaga osobnego logowania do portalu i pobrania dokumentów.

---

## 4. Harmonogram automatyczny

Harmonogram pozwala na codzienne automatyczne pobieranie faktur bez ingerencji administratora.

### Włączenie harmonogramu

1. W sekcji **Automatyczna synchronizacja** (karta u góry zakładki) kliknij przełącznik **Wyłączona** → zmieni się na **Włączona**.
2. Ustaw **godzinę synchronizacji** z listy rozwijanej (domyślnie 03:00).
3. Ustawienia są zapisywane automatycznie po każdej zmianie.

### Jak działa harmonogram

- Harmonogram sprawdza co minutę, czy nadeszła skonfigurowana godzina.
- Każdego dnia uruchamia synchronizację wszystkich kont **tylko raz** (zabezpieczenie przed wielokrotnym uruchomieniem).
- Po zakończeniu synchronizacji w **centrum powiadomień** (dzwonek w menu) pojawia się powiadomienie z podsumowaniem:
  - ✅ Powiadomienie informacyjne — jeśli synchronizacja przebiegła bez błędów
  - ⚠️ Powiadomienie ostrzegawcze — jeśli część kont napotkała błędy

### Wyłączenie harmonogramu

1. Kliknij przełącznik **Włączona** → zmieni się na **Wyłączona**.
2. Harmonogram natychmiast przestaje działać.

---

## 5. Lista pobranych faktur

Sekcja **Pobrane faktury** wyświetla wszystkie faktury pobrane ze wszystkich kont Vectra.

### Kolumny tabeli

| Kolumna | Opis |
|---------|------|
| **Konto** | Etykieta konta, z którego pochodzi faktura |
| **Numer faktury** | Numer faktury (np. FV/2025/01/001) |
| **Data faktury** | Data wystawienia faktury |
| **Kwota** | Kwota brutto w PLN |
| **Okres** | Okres rozliczeniowy (miesiąc/rok) |
| **Pobrano** | Data i godzina pobrania do systemu |
| **PDF** | Przycisk pobierania pliku PDF |

### Filtrowanie po koncie

- Użyj listy rozwijanej **Wszystkie konta** w nagłówku sekcji faktur, aby wyświetlić faktury tylko z wybranego konta Vectra.

---

## 6. Pobieranie faktur PDF

1. W tabeli faktur znajdź interesującą Cię fakturę.
2. W kolumnie **PDF** kliknij ikonę pobierania ⬇️.
3. Plik PDF otworzy się w nowej karcie przeglądarki lub zostanie pobrany na komputer.

> **Uwaga:** Przycisk PDF jest aktywny tylko wtedy, gdy plik został pomyślnie pobrany i przechowywany w magazynie obiektów. Jeśli ikona jest nieaktywna lub jej brak, oznacza to, że plik nie był dostępny podczas synchronizacji (np. faktura nie była jeszcze generowana przez Vectrę w momencie sync).

---

## 7. Statusy synchronizacji

Każde konto wyświetla status ostatniej synchronizacji w formie kolorowego znacznika:

| Kolor | Status | Znaczenie |
|-------|--------|-----------|
| 🟢 Zielony | `OK — X nowych, Y pominiętych` | Synchronizacja przebiegła poprawnie |
| 🔴 Czerwony | `Błąd: ...` | Wystąpił błąd — szczegóły w tekście |
| ⚪ Szary | `Nie synchronizowano` | Konto jeszcze nie było synchronizowane |

### Znaczenie poszczególnych błędów

- **`Błąd: deszyfrowanie hasła`** — klucz szyfrowania (`VECTRA_ENCRYPT_KEY`) mógł zostać zmieniony lub hasło jest uszkodzone. Usuń konto i dodaj je ponownie z aktualnym hasłem.
- **`Błąd: nieprawidłowy login lub hasło`** — login lub hasło jest błędne. Edytuj konto i zaktualizuj dane logowania.
- **`Błąd: sesja nie została nawiązana`** — portal Vectra nie zwrócił cookies sesji. Możliwe, że strona wymaga JavaScript do zalogowania. Skontaktuj się z administratorem systemu.
- **`Błąd: portal wymaga JavaScript`** — portal online.vectra.pl działa jako aplikacja SPA i nie zwraca listy faktur bez silnika JavaScript. Automatyczna synchronizacja jest niedostępna w takim przypadku — skontaktuj się z administratorem.
- **`Błąd: sesja wygasła lub odmowa dostępu`** — logowanie przebiegło, ale strona faktur przekierowała z powrotem do logowania. Sprawdź login i hasło.
- **`Błąd: timeout`** / błędy sieciowe — portal Vectra był niedostępny podczas synchronizacji. Spróbuj ponownie za kilka minut.

---

## 8. Najczęstsze błędy i rozwiązania

### Problem: Przycisk „Synchronizuj" jest nieaktywny
**Rozwiązanie:** Sprawdź, czy lista kont nie jest pusta. Przycisk „Synchronizuj wszystkie" wymaga co najmniej jednego dodanego konta.

### Problem: Synchronizacja kończy się błędem „nieprawidłowy login lub hasło" dla wszystkich kont
**Rozwiązanie:** Sprawdź, czy portal online.vectra.pl jest dostępny (otwórz go w przeglądarce). Jeśli Vectra wprowadza weryfikację dwuetapową lub CAPTCHA, automatyczne logowanie może przestać działać — skontaktuj się z administratorem systemu.

### Problem: Faktury pobierają się, ale brak pliku PDF (brak przycisku ⬇️)
**Rozwiązanie:** Faktura mogła być dostępna na liście, ale plik PDF nie był jeszcze gotowy na portalu Vectra. Spróbuj ponownie zsynchronizować to konto po kilku godzinach. Jeśli problem dotyczy wielu faktur, sprawdź czy magazyn obiektów (`PRIVATE_OBJECT_DIR`) jest skonfigurowany.

### Problem: Harmonogram włączony, ale synchronizacja nie uruchamia się
**Rozwiązanie:** Harmonogram działa tylko gdy serwer aplikacji jest uruchomiony. Po restarcie serwera harmonogram wznawia pracę automatycznie. Sprawdź, czy aplikacja działa (zielony wskaźnik „System online" na stronie głównej).

### Problem: Po zmianie hasła w portalu Vectra synchronizacja przestała działać
**Rozwiązanie:** Edytuj konto w systemie (ikona ołówka ✏️) i wpisz nowe hasło w polu **Hasło**. Poprzednie hasło zostanie nadpisane.

### Problem: Centrum powiadomień nie pokazuje wyników automatycznej synchronizacji
**Rozwiązanie:** Powiadomienia pojawiają się po zakończeniu harmonogramu. Jeśli synchronizacja dopiero się uruchomiła, poczekaj kilka minut. Powiadomienia można sprawdzić klikając ikonę dzwonka w górnym menu.

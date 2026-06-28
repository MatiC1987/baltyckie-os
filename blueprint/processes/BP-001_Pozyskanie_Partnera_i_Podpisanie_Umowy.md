# BP-001 – Pozyskanie partnera i podpisanie umowy

**Status:** Draft
**Wersja:** 0.1

## Cel procesu
Przekształcenie nowego partnera biznesowego w aktywną współpracę, która automatycznie tworzy komplet danych operacyjnych i finansowych w Bałtyckie OS.

## Zdarzenie rozpoczynające
Zapadła decyzja o rozpoczęciu współpracy i podpisaniu umowy.

## Dane wejściowe
- Partner (nowy lub istniejący)
- Typ umowy (gwarantowana / prowizyjna / hybrydowa)
- Apartamenty objęte umową
- Warunki finansowe
- Harmonogram płatności
- Data rozpoczęcia współpracy

## Automatyczne działania systemu
1. Utworzenie lub aktualizacja Partnera.
2. Utworzenie Umowy.
3. Powiązanie wszystkich apartamentów z umową.
4. Wygenerowanie prognoz przychodów dla każdego apartamentu.
5. Wygenerowanie prognoz kosztów.
6. Utworzenie harmonogramu płatności.
7. Aktualizacja prognozy salda firmy.
8. Dodanie wpisu do Timeline współpracy.
9. Utworzenie zadań wdrożeniowych (Hotres, zdjęcia, konfiguracja sprzedaży).

## Reguły biznesowe
- Jedna umowa może obejmować wiele apartamentów.
- Koszty mogą być przypisane do konkretnego apartamentu lub dzielone pomiędzy wszystkie apartamenty objęte umową.
- Prognoza trwa do momentu świadomego zakończenia współpracy przez użytkownika, niezależnie od formalnej daty zakończenia umowy.

## Wynik procesu
Partner posiada aktywną relację biznesową, wszystkie apartamenty są gotowe do dalszej konfiguracji, a prognozy i zobowiązania finansowe są automatycznie utworzone.
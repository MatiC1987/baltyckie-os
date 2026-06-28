# BP-002 – Dodanie apartamentu

**Status:** Draft
**Wersja:** 0.1

## Cel
Utworzenie nowej jednostki biznesowej (apartamentu) powiązanej z partnerem i umową oraz przygotowanie jej do sprzedaży i analiz finansowych.

## Dane podstawowe
- Nazwa apartamentu
- Lokalizacja (np. Bulwar Portowy)
- Adres
- Partner
- Umowa
- Status (przygotowanie / aktywny / wyłączony)

## Dane konfiguracyjne
- Id apartamentu w Hotres
- Typ prognozy przychodów (12 m-cy, sezonowa, ręczna)
- Typ prognozy kosztów (12 m-cy, ręczna)
- Sposób rozliczania kosztów z umowy (indywidualnie / proporcjonalnie)

## Automatyczne działania
Po zapisaniu apartamentu system:
1. Łączy apartament z partnerem i umową.
2. Tworzy prognozę przychodów.
3. Tworzy prognozę kosztów.
4. Uwzględnia apartament w prognozie salda firmy.
5. Dodaje apartament do Dashboardów i analiz.
6. Tworzy zadanie konfiguracji integracji Hotres, jeśli identyfikator nie został podany.

## Dane pobierane z Hotres
Po połączeniu z API system powinien pobierać automatycznie m.in. rezerwacje, przychody z najmu krótkoterminowego, obłożenie oraz inne dane operacyjne zamiast wymagać ręcznego wprowadzania.

## Reguły
- Apartament nie istnieje bez partnera i aktywnej umowy.
- Wszystkie prognozy są edytowalne.
- Zmiana metody prognozowania przelicza wszystkie zależne analizy.
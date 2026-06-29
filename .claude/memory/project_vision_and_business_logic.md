---
name: project-vision-and-business-logic
description: "Wizja produktu, logika biznesowa i priorytety Mateusza — fundament wszystkich decyzji projektowych"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9a90505d-727f-4867-ae25-31c7193d615c
---

## Kim jest Mateusz i jak myśli

- Kilkanaście lat w Excelu → myśli bardzo logicznie, rozumie zależności między danymi
- Nie potrzebuje "wygody dla siebie" — potrzebuje narzędzia które działa logicznie i jest gotowe dla innych
- Widzi dużo możliwości w aplikacji których jeszcze nie ma — wie czego chce

## Najważniejsza zasada finansowa

**Saldo roczne, nie miesięczne** — to jest główny KPI Mateusza.

Dlaczego: koszty są cykliczne (miesięczne, kwartalne, roczne), nieregularne lub prognozowane na podstawie historii (ZUS, podatek). Miesięczny wynik jest mylący — roczne saldo daje prawdziwy obraz.

**How to apply:** Apartment Center i Dashboard powinny pokazywać perspektywę roczną jako główną, miesięczną jako drill-down.

## Struktura kosztów w firmie

- **Cykliczne:** miesięczne, kwartalne, roczne (wynikają z umów)
- **Nieregularne:** pojawiają się bez harmonogramu
- **Prognozowane z historii:** ZUS, podatek — Mateusz sam szacuje na podstawie poprzednich okresów
- Koszty muszą być powiązane z umowami i automatycznie trafiać na karty apartamentów

## Wizja systemu — czego chce Mateusz

1. **Logiczne powiązania między modułami** — akcja w jednym module automatycznie wpływa na inne
   - Umowa → płatności → koszty apartamentu → prognoza → saldo
   - Dodanie apartamentu → workflow który generuje wszystko co potrzebne

2. **Dane wprowadzane przez formularze z logiką** — nie surowe pola, ale inteligentne formularze które rozumieją kontekst

3. **Czytelne wyświetlanie zgodne z dokumentacją** — każdy ekran odpowiada na konkretne pytanie biznesowe

4. **Responsywność per urządzenie** — desktop (analityka, dużo danych), tablet (operacje), mobile (decyzje, alerty)
   - Karta apartamentu wygląda INACZEJ na każdym urządzeniu — nie jest tylko skalowana

5. **Aplikacja dopasowana dla każdego użytkownika:**
   - Mateusz: pełna analityka, decyzje strategiczne, pricing, marketing
   - Jolanta: zadania operacyjne, płatności, umowy, dokumenty, przeglądy
   - Krzysztof: podgląd wyników, bez możliwości zmian
   - Małgorzata: rezerwacje, rozliczenia przyjazd/wyjazd, sprzątanie

## Plan rozwoju firmy (wpływa na architekturę)

**Teraz (0-6 mies.):** Porządkowanie bazy, logiczne workflow, czyste moduły
**Średni termin (6-18 mies.):** Nowe modele współpracy (prowizja, hybryda), zarządzanie cenami z AI, centrum marketingowe, nowa strona www
**Długi termin (18+ mies.):** Aplikacja dla gości, skalowanie, kampania akwizycji nowych lokali w Ustce

## Ekosystem który już istnieje

- **e-baltyckie.pl** — główny system (Mateusz, Jolanta, Krzysztof)
- **e-baltyckie.pl/recepcja** — uproszczony widok dla Małgorzaty
- **e-baltyckie.pl/rcp** — PWA rejestracji czasu pracy dla pracowników
- **Hotres** — zewnętrzny PMS (rezerwacje, kanały sprzedaży, pricing) — docelowo połączony z systemem
- Nowa strona www + aplikacja dla gości — w planach, połączone z Hotres i głównym systemem

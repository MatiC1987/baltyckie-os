export interface OplatyCostItem {
  name: string;
  subLabel?: string;
}

export interface OplatyCostCategory {
  id: string;
  title: string;
  items: OplatyCostItem[];
}

export const DEFAULT_OPLATY_CATEGORIES: OplatyCostCategory[] = [
  {
    id: "wynagrodzenia",
    title: "WYNAGRODZENIA",
    items: [
      { name: "MATEUSZ CIEŚLAK" },
      { name: "KRZYSZTOF CIEŚLAK" },
      { name: "JOLANTA GŁODKOWSKA" },
      { name: "MAŁGORZATA LATASIEWICZ" },
      { name: "MAGDALENA SZYMION", subLabel: "ex. Karolina Łaździn" },
      { name: "MATEUSZ MADEJ" },
      { name: "SVIETLANA FEDORCHENKO", subLabel: "ex. Barbara Mazurek" },
      { name: "PANIE SPRZĄTAJĄCE", subLabel: "Dodatkowe prace" },
    ],
  },
  {
    id: "zus-podatki",
    title: "ZUS & PODATKI",
    items: [
      { name: "ZUS", subLabel: "Apartamenty Bałtyckie" },
      { name: "VAT-7", subLabel: "Apartamenty Bałtyckie" },
      { name: "PIT-5L", subLabel: "Apartamenty Bałtyckie" },
      { name: "PIT-4", subLabel: "Apartamenty Bałtyckie" },
      { name: "ZUS", subLabel: "Reservon" },
      { name: "VAT-7", subLabel: "Reservon" },
      { name: "PIT-5L", subLabel: "Reservon" },
      { name: "PIT-4", subLabel: "Reservon" },
    ],
  },
  {
    id: "kredyty",
    title: "KREDYTY & POŻYCZKI",
    items: [
      { name: "PFP - POŻYCZKA PŁYNNOŚCIOWA", subLabel: "AB" },
      { name: "PFR - SUBWENCJA", subLabel: "AB" },
      { name: "LEASING - MAZDA 3", subLabel: "Multirent" },
      { name: "LEASING - AUDI Q7", subLabel: "VW Leasing" },
      { name: "LEASING - AUDI A7", subLabel: "VW Leasing" },
      { name: "LEASING - VW TIGUAN", subLabel: "VW Leasing" },
      { name: "PFP - POŻYCZKA INWESTYCYJNA", subLabel: "Reservon" },
      { name: "PFP - POŻYCZKA PŁYNNOŚCIOWA", subLabel: "Reservon" },
    ],
  },
  {
    id: "nieruchomosci",
    title: "NIERUCHOMOŚCI",
    items: [
      { name: "CZYNSZ - OSiR", subLabel: "Magazyn PKS" },
      { name: "CZYNSZ - OSiR", subLabel: "Biuro PKS" },
      { name: "OGRZEWANIE - OSiR" },
      { name: "ENERGA - OSiR" },
      { name: "CZYNSZ (GS SAMOPOMOC)" },
      { name: "ENERGIA+WODA (GS SAMOPOMOC)" },
      { name: "OGRZEWANIE (GS SAMOPOMOC)" },
      { name: "WYWÓZ ŚMIECI" },
      { name: "CZYNSZ DO WSPÓLNOTY" },
      { name: "ENERGA" },
    ],
  },
  {
    id: "ksiegowosc",
    title: "OBSŁUGA PRAWNO-KSIĘGOWA",
    items: [
      { name: "PERFEKT - BIURO KSIĘGOWE", subLabel: "AB" },
      { name: "ARTUR BARYŁO - OBSŁUGA PRAWNA" },
      { name: "OPŁATY SĄDOWE" },
      { name: "KRD - KRAJOWY REJESTR DŁUGÓW" },
      { name: "PERFEKT - BIURO KSIĘGOWE", subLabel: "Reservon" },
    ],
  },
  {
    id: "reklama",
    title: "MARKETING & REKLAMA",
    items: [
      { name: "BOOKING.COM", subLabel: "Grand Baltic (2370107)" },
      { name: "BOOKING.COM", subLabel: "Bulwar Portowy (822580)" },
      { name: "BOOKING.COM", subLabel: "Wczasowa (6042647)" },
      { name: "BOOKING.COM", subLabel: "Na Wydmie (778716)" },
      { name: "BOOKING.COM", subLabel: "Baltic Park (6248325)" },
      { name: "BOOKING.COM", subLabel: "Słoneczna Oaza (5184590)" },
      { name: "BOOKING.COM", subLabel: "Luxuro Park (9874893)" },
      { name: "PROFITLAB", subLabel: "Kamil Rodziewicz" },
      { name: "GOOGLE ADS", subLabel: "Adrian Ginda" },
      { name: "GOOGLE ADS" },
    ],
  },
  {
    id: "uslugi",
    title: "USŁUGI",
    items: [
      { name: "VECTRA" },
      { name: "NC+" },
      { name: "WP TV", subLabel: "Luxuro+Modern" },
      { name: "INTERARENA", subLabel: "Grand Baltic+Luxuro" },
      { name: "ORANGE" },
      { name: "T-MOBILE" },
      { name: "MICROSOFT OFFICE" },
      { name: "ORANGE", subLabel: "Reservon" },
      { name: "T-MOBILE", subLabel: "Reservon" },
    ],
  },
  {
    id: "pozostale",
    title: "POZOSTAŁE",
    items: [
      { name: "CHEMIA + BHP" },
      { name: "DOPOSAŻENIA APARTAMENTÓW" },
      { name: "REMONTY APARTAMENTÓW" },
      { name: "POLISY & UBEZPIECZENIA" },
    ],
  },
];

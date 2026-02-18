export interface OplatyCostItem {
  name: string;
  subLabel?: string;
}

export interface OplatyCostCategory {
  id: string;
  title: string;
  color: string;
  items: OplatyCostItem[];
}

export const DEFAULT_OPLATY_CATEGORIES: OplatyCostCategory[] = [
  {
    id: "wynagrodzenia",
    title: "WYNAGRODZENIA",
    color: "bg-blue-600 dark:bg-blue-700",
    items: [
      { name: "MATEUSZ CIEŚLAK" },
      { name: "KRZYSZTOF CIEŚLAK" },
      { name: "JOLANTA GŁODKOWSKA" },
      { name: "KAROLINA ŁAŹDZIN" },
      { name: "MAŁGORZATA LATASIEWICZ" },
      { name: "MATEUSZ MADEJ" },
      { name: "BARBARA MAZUREK" },
      { name: "INNE" },
    ],
  },
  {
    id: "zus-podatki",
    title: "ZUS & PODATKI",
    color: "bg-red-600 dark:bg-red-700",
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
    color: "bg-purple-600 dark:bg-purple-700",
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
    color: "bg-emerald-600 dark:bg-emerald-700",
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
    color: "bg-amber-600 dark:bg-amber-700",
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
    color: "bg-pink-600 dark:bg-pink-700",
    items: [
      { name: "BOOKING.COM", subLabel: "Prowizja" },
      { name: "PROFITROOM", subLabel: "Channel Manager" },
      { name: "PROFITLAB", subLabel: "Marketing Automation" },
      { name: "GOOGLE ADS", subLabel: "Adrian Ginda" },
      { name: "GOOGLE ADS" },
      { name: "AGENT" },
    ],
  },
  {
    id: "uslugi",
    title: "USŁUGI",
    color: "bg-cyan-600 dark:bg-cyan-700",
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
    color: "bg-slate-600 dark:bg-slate-700",
    items: [
      { name: "CHEMIA + BHP" },
      { name: "DOPOSAŻENIA APARTAMENTÓW" },
      { name: "REMONTY APARTAMENTÓW" },
      { name: "POLISY & UBEZPIECZENIA" },
      { name: "PRALNIA MIETER (KOSZALIN)" },
      { name: "INNE" },
      { name: "INNE", subLabel: "Reservon" },
      { name: "INNE", subLabel: "Inne" },
    ],
  },
];

export function loadOplatyCategories(): OplatyCostCategory[] {
  try {
    const raw = localStorage.getItem("oplaty-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_OPLATY_CATEGORIES;
}

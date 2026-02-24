import { DEFAULT_OPLATY_CATEGORIES as SHARED_CATEGORIES } from "@shared/oplaty-defaults";
import type { OplatyCostCategory as SharedCategory, OplatyCostItem } from "@shared/oplaty-defaults";

export type { OplatyCostItem };

export interface OplatyCostCategory extends SharedCategory {
  color: string;
  archived?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "wynagrodzenia": "bg-blue-600 dark:bg-blue-700",
  "zus-podatki": "bg-red-600 dark:bg-red-700",
  "kredyty": "bg-purple-600 dark:bg-purple-700",
  "nieruchomosci": "bg-emerald-600 dark:bg-emerald-700",
  "ksiegowosc": "bg-amber-600 dark:bg-amber-700",
  "reklama": "bg-pink-600 dark:bg-pink-700",
  "uslugi": "bg-cyan-600 dark:bg-cyan-700",
  "pozostale": "bg-slate-600 dark:bg-slate-700",
};

export const DEFAULT_OPLATY_CATEGORIES: OplatyCostCategory[] = SHARED_CATEGORIES.map(cat => ({
  ...cat,
  color: CATEGORY_COLORS[cat.id] || "bg-slate-600 dark:bg-slate-700",
}));

export function loadOplatyCategories(): OplatyCostCategory[] {
  try {
    const raw = localStorage.getItem("oplaty-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_OPLATY_CATEGORIES;
}

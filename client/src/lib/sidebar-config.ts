import {
  LayoutDashboard, TrendingUp, CalendarDays, ClipboardList, Plane,
  Wallet, Receipt, HandCoins, BarChart3, Building, Building2, Coins,
  Scale, FileText, FileSignature, Briefcase, Files, Upload, Download,
  Users, Settings, MapPin, CalendarRange, CalendarCheck, Landmark,
  GitCompareArrows, FileSpreadsheet, FileDown, DatabaseBackup, History,
  UserCog, PieChart, ArrowUpDown, Thermometer, LineChart, BadgeDollarSign,
  Home, Gauge, Calculator, ScrollText, Wrench, Plus, Minus, Tag, Type,
  Star, Heart, Zap, Target, Flag, Bookmark, Bell, Clock, Globe, Lock,
  Mail, Phone, Camera, Coffee, Music, Palette, Layers, Box, Circle,
  Square, Triangle, Hexagon, Wifi, Cloud, Database, Server, Monitor,
  Smartphone, Tablet, Tv, Radio, Headphones, Mic, Video, Image,
  FolderOpen, Archive, Trash2, Edit, Eye, EyeOff, Search, Filter,
  SortAsc, AlertCircle, CheckCircle, Info, HelpCircle, MessageSquare,
  Send, Share2, Link, Paperclip, Scissors, Copy, Clipboard, Terminal,
  Code, GitBranch, Package, Truck, ShoppingCart, CreditCard, DollarSign,
  Percent, TrendingDown, Activity, Award, Gift, Umbrella, Map, Navigation,
  Compass, Anchor, Sun, Moon, CloudRain, Wind, Droplet, Flame,
  type LucideIcon
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  iconName: string;
  type?: "item" | "separator" | "label";
  hidden?: boolean;
}

export interface NavSection {
  id: string;
  title?: string;
  itemIds: string[];
  iconName?: string;
  color?: string;
  isCustom?: boolean;
}

export interface SidebarLayout {
  sections: NavSection[];
  items: Record<string, NavItem>;
}

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, TrendingUp, CalendarDays, ClipboardList, Plane,
  Wallet, Receipt, HandCoins, BarChart3, Building, Building2, Coins,
  Scale, FileText, FileSignature, Briefcase, Files, Upload, Download,
  Users, Settings, MapPin, CalendarRange, CalendarCheck, Landmark,
  GitCompareArrows, FileSpreadsheet, FileDown, DatabaseBackup, History,
  UserCog, PieChart, ArrowUpDown, Thermometer, LineChart, BadgeDollarSign,
  Home, Gauge, Calculator, ScrollText, Wrench, Plus, Minus, Tag, Type,
  Star, Heart, Zap, Target, Flag, Bookmark, Bell, Clock, Globe, Lock,
  Mail, Phone, Camera, Coffee, Music, Palette, Layers, Box, Circle,
  Square, Triangle, Hexagon, Wifi, Cloud, Database, Server, Monitor,
  Smartphone, Tablet, Tv, Radio, Headphones, Mic, Video, Image,
  FolderOpen, Archive, Trash2, Edit, Eye, EyeOff, Search, Filter,
  SortAsc, AlertCircle, CheckCircle, Info, HelpCircle, MessageSquare,
  Send, Share2, Link, Paperclip, Scissors, Copy, Clipboard, Terminal,
  Code, GitBranch, Package, Truck, ShoppingCart, CreditCard, DollarSign,
  Percent, TrendingDown, Activity, Award, Gift, Umbrella, Map, Navigation,
  Compass, Anchor, Sun, Moon, CloudRain, Wind, Droplet, Flame,
};

export const ICON_CATEGORIES: { label: string; icons: string[] }[] = [
  { label: "Popularne", icons: ["LayoutDashboard", "Home", "Star", "Heart", "Zap", "Target", "Flag", "Bookmark", "Bell", "Clock"] },
  { label: "Finanse", icons: ["Wallet", "Receipt", "Coins", "DollarSign", "CreditCard", "BadgeDollarSign", "Calculator", "Percent", "TrendingUp", "TrendingDown", "BarChart3", "PieChart", "LineChart", "Activity", "Scale"] },
  { label: "Budynki", icons: ["Building", "Building2", "Home", "Landmark", "MapPin", "Map", "Navigation", "Compass", "Globe"] },
  { label: "Dokumenty", icons: ["FileText", "FileSignature", "FileSpreadsheet", "FileDown", "Files", "FolderOpen", "Archive", "Clipboard", "ScrollText"] },
  { label: "Osoby", icons: ["Users", "UserCog", "Mail", "Phone", "MessageSquare", "Send", "Share2"] },
  { label: "Narzędzia", icons: ["Settings", "Wrench", "Edit", "Search", "Filter", "Code", "Terminal", "GitBranch", "Package", "Database", "Server"] },
  { label: "Media", icons: ["Camera", "Image", "Video", "Mic", "Music", "Headphones", "Radio", "Tv", "Monitor", "Smartphone", "Tablet"] },
  { label: "Kształty", icons: ["Circle", "Square", "Triangle", "Hexagon", "Box", "Layers"] },
  { label: "Inne", icons: ["Coffee", "Palette", "Gift", "Award", "Umbrella", "Anchor", "ShoppingCart", "Truck", "Briefcase", "CalendarDays", "CalendarRange", "CalendarCheck"] },
];

export const SECTION_COLORS: { label: string; value: string; className: string }[] = [
  { label: "Cyjan", value: "cyan", className: "text-cyan-400" },
  { label: "Zielony", value: "emerald", className: "text-emerald-400" },
  { label: "Fioletowy", value: "violet", className: "text-violet-400" },
  { label: "Niebieski", value: "blue", className: "text-blue-400" },
  { label: "Pomarańczowy", value: "orange", className: "text-orange-400" },
  { label: "Różowy", value: "pink", className: "text-pink-400" },
  { label: "Żółty", value: "yellow", className: "text-yellow-400" },
  { label: "Czerwony", value: "red", className: "text-red-400" },
  { label: "Szary", value: "slate", className: "text-slate-500" },
];

export function getSectionColorClass(color?: string): string {
  const found = SECTION_COLORS.find(c => c.value === color);
  return found?.className || "text-slate-500";
}

export const DEFAULT_ITEMS: Record<string, NavItem> = {
  kokpit: { id: "kokpit", href: "/", label: "Pulpit", iconName: "LayoutDashboard" },
  calendar: { id: "calendar", href: "/calendar", label: "Terminarz", iconName: "CalendarDays" },
  reservations: { id: "reservations", href: "/reservations", label: "Rezerwacje", iconName: "ClipboardList" },
  podnajem: { id: "podnajem", href: "/podnajem", label: "Podnajem", iconName: "FileSignature" },
  analizy: { id: "analizy", href: "/analizy", label: "Analizy", iconName: "BarChart3" },
  "finance-forecast": { id: "finance-forecast", href: "/finance-forecast", label: "Prognoza finansowa", iconName: "TrendingUp" },
  "revenue": { id: "revenue", href: "/revenue", label: "Przychody", iconName: "Wallet" },
  "koszty": { id: "koszty", href: "/koszty", label: "Koszty", iconName: "Calculator" },
  "apartment-schedule": { id: "apartment-schedule", href: "/apartment-schedule", label: "Harmonogram", iconName: "CalendarCheck" },
  salda: { id: "salda", href: "/salda", label: "Salda", iconName: "Scale" },
  invoices: { id: "invoices", href: "/invoices", label: "Faktury", iconName: "FileSpreadsheet" },
  "dokumenty-ksiegowe": { id: "dokumenty-ksiegowe", href: "/dokumenty-ksiegowe", label: "Dokumenty księgowe", iconName: "FileText" },
  "contracts-services": { id: "contracts-services", href: "/contracts-services", label: "Usługi", iconName: "Briefcase" },
  "przeglady": { id: "przeglady", href: "/przeglady", label: "Przeglądy", iconName: "Wrench" },
  "customers": { id: "customers", href: "/customers", label: "Klienci", iconName: "Users" },
  "tasks": { id: "tasks", href: "/tasks", label: "Zadania", iconName: "ClipboardList" },
  "source-comparison": { id: "source-comparison", href: "/source-comparison", label: "Porównanie źródeł", iconName: "GitCompareArrows" },
};

export const DEFAULT_SECTIONS: NavSection[] = [
  { id: "main", itemIds: ["kokpit"] },
  { id: "rezerwacje", title: "REZERWACJE", itemIds: ["calendar", "podnajem", "reservations", "customers"], color: "cyan" },
  { id: "zarzadzanie", title: "ZARZĄDZANIE", itemIds: ["tasks"], color: "violet" },
  { id: "finanse", title: "FINANSE", itemIds: ["analizy", "source-comparison", "finance-forecast", "revenue", "koszty", "apartment-schedule", "salda", "invoices", "dokumenty-ksiegowe", "contracts-services", "przeglady"], color: "emerald" },
];

export const STORAGE_KEY = "sidebar-layout-v6";
export const COLLAPSED_KEY = "sidebar-collapsed-v2";
export const LABELS_KEY = "sidebar-custom-labels-v1";
export const HIDDEN_KEY = "sidebar-hidden-items-v1";
export const CUSTOM_ITEMS_KEY = "sidebar-custom-items-v1";

export function loadCustomLabels(): Record<string, string> {
  try {
    const stored = localStorage.getItem(LABELS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

export function saveCustomLabels(labels: Record<string, string>) {
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(labels)); } catch {}
}

export function loadHiddenItems(): Set<string> {
  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

export function saveHiddenItems(hidden: Set<string>) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])); } catch {}
}

export function loadCustomItems(): Record<string, NavItem> {
  try {
    const stored = localStorage.getItem(CUSTOM_ITEMS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

export function saveCustomItems(items: Record<string, NavItem>) {
  try { localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(items)); } catch {}
}

export function loadCollapsed(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

export function saveCollapsed(collapsed: Set<string>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed])); } catch {}
}

export function reconcileLayout(stored: { sections: NavSection[] }): SidebarLayout {
  const allDefaultIds = new Set(Object.keys(DEFAULT_ITEMS));
  const validDefaultSectionIds = new Set(DEFAULT_SECTIONS.map(s => s.id));

  const customSections = stored.sections.filter(s => s.isCustom);
  const defaultSections = stored.sections.filter(s => !s.isCustom);

  const seen = new Set<string>();
  const sections: NavSection[] = DEFAULT_SECTIONS.map(ds => {
    const match = defaultSections.find(s => s.id === ds.id);
    const itemIds = (match ? match.itemIds : ds.itemIds).filter(id => {
      if (seen.has(id)) return false;
      if (!allDefaultIds.has(id) && !id.startsWith("sep-") && !id.startsWith("label-")) return false;
      seen.add(id);
      return true;
    });
    return { ...ds, title: ds.title, itemIds, color: match?.color || ds.color };
  });

  const itemsInCustomSections = new Set<string>();
  for (const cs of customSections) {
    for (const id of cs.itemIds) {
      itemsInCustomSections.add(id);
    }
  }

  const orphaned = [...allDefaultIds].filter(id => !seen.has(id) && !itemsInCustomSections.has(id));
  if (orphaned.length > 0 && sections.length > 0) {
    sections[sections.length - 1].itemIds.push(...orphaned);
  }

  const finalSections = [...sections, ...customSections];

  return { sections: finalSections, items: { ...DEFAULT_ITEMS } };
}

export function loadLayout(): SidebarLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { sections: NavSection[] };
      return reconcileLayout(parsed);
    }
  } catch {}
  return { sections: DEFAULT_SECTIONS.map(s => ({ ...s })), items: { ...DEFAULT_ITEMS } };
}

export function saveLayout(sections: NavSection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, items: {} }));
  } catch {}
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
export function syncToServer(layout: NavSection[], collapsed: Set<string>, labels: Record<string, string>, hidden?: Set<string>) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const payload: any = {
        sidebarLayout: JSON.stringify({ sections: layout }),
        sidebarCollapsed: JSON.stringify([...collapsed]),
        sidebarLabels: JSON.stringify(labels),
      };
      if (hidden) {
        payload.sidebarHidden = JSON.stringify([...hidden]);
      }
      await apiRequest("PUT", "/api/user-preferences", payload);
    } catch {}
  }, 1000);
}

export function findSectionOfItem(sections: NavSection[], itemId: string): string | null {
  for (const section of sections) {
    if (section.itemIds.includes(itemId)) return section.id;
  }
  return null;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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
  Percent, TrendingDown, Activity, Award, Gift, Umbrella, Map as MapIcon, Navigation,
  Compass, Anchor, Sun, Moon, CloudRain, Wind, Droplet, Flame,
  type LucideIcon
} from "lucide-react";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  iconName: string;
  type?: "item" | "separator" | "label";
}

export interface NavSection {
  id: string;
  title?: string;
  itemIds: string[];
  iconName?: string;
  color?: string;
  isCustom?: boolean;
}

export interface SidebarConfig {
  sections: NavSection[];
  customItems: Record<string, NavItem>;
  hiddenItems: string[];
  customLabels: Record<string, string>;
  collapsed: string[];
  compact: boolean;
  badgeConfig: Record<string, boolean>;
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
  Percent, TrendingDown, Activity, Award, Gift, Umbrella, Map: MapIcon, Navigation,
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
  if (!color) return "text-slate-500";
  if (color.startsWith("#")) return "";
  const found = SECTION_COLORS.find(c => c.value === color);
  return found?.className || "text-slate-500";
}

export function getSectionColorStyle(color?: string): { color: string } | undefined {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return { color };
  return undefined;
}

export const COLOR_PALETTE: string[] = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#94a3b8", "#ffffff",
];

export const DEFAULT_ITEMS: Record<string, NavItem> = {
  kokpit: { id: "kokpit", href: "/", label: "Pulpit", iconName: "LayoutDashboard" },
  calendar: { id: "calendar", href: "/calendar", label: "Terminarz", iconName: "CalendarDays" },
  reservations: { id: "reservations", href: "/reservations", label: "Rezerwacje", iconName: "ClipboardList" },
  podnajem: { id: "podnajem", href: "/podnajem", label: "Podnajem", iconName: "FileSignature" },
  analizy: { id: "analizy", href: "/analizy", label: "Analizy", iconName: "BarChart3" },
  "finance-forecast": { id: "finance-forecast", href: "/finance-forecast", label: "Prognoza finansowa", iconName: "TrendingUp" },
  "revenue": { id: "revenue", href: "/revenue", label: "Przychody", iconName: "Wallet" },
  "koszty-apartamentowe": { id: "koszty-apartamentowe", href: "/koszty-apartamentowe", label: "Koszty apartamentów", iconName: "Calculator" },
  "koszty-operacyjne": { id: "koszty-operacyjne", href: "/koszty-operacyjne", label: "Koszty operacyjne", iconName: "Receipt" },
  "apartment-schedule": { id: "apartment-schedule", href: "/apartment-schedule", label: "Harmonogram", iconName: "CalendarCheck" },
  salda: { id: "salda", href: "/salda", label: "Salda", iconName: "Scale" },
  invoices: { id: "invoices", href: "/invoices", label: "Faktury", iconName: "FileSpreadsheet" },
  "dokumenty-ksiegowe": { id: "dokumenty-ksiegowe", href: "/dokumenty-ksiegowe", label: "Dokumenty księgowe", iconName: "FileText" },
  "contracts-services": { id: "contracts-services", href: "/contracts-services", label: "Umowy", iconName: "Briefcase" },
  "przeglady": { id: "przeglady", href: "/przeglady", label: "Przeglądy", iconName: "Wrench" },
  "customers": { id: "customers", href: "/customers", label: "Klienci", iconName: "Users" },
  "tasks": { id: "tasks", href: "/tasks", label: "Zadania", iconName: "ClipboardList" },
  "source-comparison": { id: "source-comparison", href: "/source-comparison", label: "Porównanie źródeł", iconName: "GitCompareArrows" },
  "apartments": { id: "apartments", href: "/apartments", label: "Apartamenty", iconName: "Building2" },
  "owners": { id: "owners", href: "/owners", label: "Właściciele", iconName: "Users" },
  "v2-przychody": { id: "v2-przychody", href: "/v2/przychody", label: "Przychody v2", iconName: "Wallet" },
  "v2-koszty": { id: "v2-koszty", href: "/v2/koszty", label: "Koszty v2", iconName: "Calculator" },
  "v2-prognoza": { id: "v2-prognoza", href: "/v2/prognoza", label: "Prognoza finansowa v2", iconName: "TrendingUp" },
  "v2-realizacja": { id: "v2-realizacja", href: "/v2/realizacja", label: "Realizacja v2", iconName: "Target" },
};

export const DEFAULT_SECTIONS: NavSection[] = [
  { id: "main", itemIds: ["kokpit"] },
  { id: "rezerwacje", title: "REZERWACJE", itemIds: ["calendar", "podnajem", "reservations", "customers"], color: "cyan" },
  { id: "zarzadzanie", title: "ZARZĄDZANIE", itemIds: ["apartments", "owners", "tasks"], color: "violet" },
  { id: "finanse", title: "FINANSE", itemIds: ["analizy", "source-comparison", "finance-forecast", "revenue", "koszty-apartamentowe", "koszty-operacyjne", "apartment-schedule", "salda", "invoices", "dokumenty-ksiegowe", "contracts-services", "przeglady"], color: "emerald" },
  { id: "finanse-v2", title: "FINANSE v2", itemIds: ["v2-prognoza", "v2-przychody", "v2-koszty", "v2-realizacja"], color: "orange" },
];

export const DEFAULT_CONFIG: SidebarConfig = {
  sections: DEFAULT_SECTIONS.map(s => ({ ...s })),
  customItems: {},
  hiddenItems: [],
  customLabels: {},
  collapsed: [],
  compact: false,
  badgeConfig: { "koszty-apartamentowe": true, "apartment-schedule": true, podnajem: true },
};

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STORAGE_KEY = "sidebar-config-v10";

export function loadConfigFromStorage(): SidebarConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function saveConfigToStorage(config: SidebarConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function reconcileConfig(stored: Partial<SidebarConfig>): SidebarConfig {
  const sections = stored.sections || DEFAULT_CONFIG.sections.map(s => ({ ...s }));
  const allDefaultIds = new Set(Object.keys(DEFAULT_ITEMS));
  const seen = new Set<string>();
  const reconciledSections: NavSection[] = [];
  const defaultSectionMap = new Map(DEFAULT_SECTIONS.map(s => [s.id, s]));

  for (const section of sections) {
    if (section.isCustom) {
      reconciledSections.push(section);
      for (const id of section.itemIds) seen.add(id);
      continue;
    }
    const ds = defaultSectionMap.get(section.id);
    if (!ds) continue;
    defaultSectionMap.delete(section.id);
    const itemIds = section.itemIds.filter(id => {
      if (seen.has(id)) return false;
      if (!allDefaultIds.has(id) && !id.startsWith("sep-") && !id.startsWith("label-")) return false;
      seen.add(id);
      return true;
    });
    reconciledSections.push({ ...ds, title: ds.title, itemIds, color: section.color || ds.color });
  }

  for (const [, ds] of defaultSectionMap) {
    const itemIds = ds.itemIds.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    reconciledSections.push({ ...ds, itemIds });
  }

  const orphaned = [...allDefaultIds].filter(id => !seen.has(id));
  if (orphaned.length > 0 && reconciledSections.length > 0) {
    const lastDefault = [...reconciledSections].reverse().find(s => !s.isCustom);
    if (lastDefault) lastDefault.itemIds.push(...orphaned);
    else reconciledSections[reconciledSections.length - 1].itemIds.push(...orphaned);
  }

  return {
    sections: reconciledSections,
    customItems: stored.customItems || {},
    hiddenItems: stored.hiddenItems || [],
    customLabels: stored.customLabels || {},
    collapsed: stored.collapsed || [],
    compact: stored.compact ?? false,
    badgeConfig: stored.badgeConfig ?? { "koszty-apartamentowe": true, "apartment-schedule": true, podnajem: true },
  };
}

export function parseServerConfig(serverPrefs: any): SidebarConfig | null {
  try {
    if (!serverPrefs?.sidebarLayout) return null;
    const parsed = JSON.parse(serverPrefs.sidebarLayout);
    if (parsed?.sections) {
      let collapsed = parsed.collapsed || [];
      let customLabels = parsed.customLabels || {};
      if (serverPrefs.sidebarCollapsed && !parsed.collapsed) {
        try { collapsed = JSON.parse(serverPrefs.sidebarCollapsed); } catch {}
      }
      if (serverPrefs.sidebarLabels && !parsed.customLabels) {
        try { customLabels = JSON.parse(serverPrefs.sidebarLabels); } catch {}
      }
      return reconcileConfig({ ...parsed, collapsed, customLabels });
    }
  } catch {}
  return null;
}

export function serializeForServer(config: SidebarConfig): string {
  return JSON.stringify({
    sections: config.sections,
    customItems: config.customItems,
    hiddenItems: config.hiddenItems,
    customLabels: config.customLabels,
    collapsed: config.collapsed,
    compact: config.compact,
    badgeConfig: config.badgeConfig,
  });
}

export interface PresetLayout {
  id: string;
  label: string;
  description: string;
  sections: NavSection[];
  hiddenItems?: string[];
}

export const PRESET_LAYOUTS: PresetLayout[] = [
  {
    id: "default",
    label: "Domyślny",
    description: "Standardowy układ z trzema sekcjami: Rezerwacje, Zarządzanie i Finanse",
    sections: DEFAULT_SECTIONS.map(s => ({ ...s })),
  },
  {
    id: "compact",
    label: "Kompaktowy",
    description: "Uproszczony układ z najważniejszymi elementami w jednej sekcji",
    sections: [
      { id: "main", itemIds: ["kokpit"] },
      { id: "all", title: "MENU", itemIds: ["calendar", "reservations", "podnajem", "apartments", "tasks", "analizy", "revenue", "koszty-apartamentowe", "koszty-operacyjne", "invoices"], color: "cyan" },
    ],
    hiddenItems: ["source-comparison", "apartment-schedule", "salda", "dokumenty-ksiegowe", "contracts-services", "przeglady", "finance-forecast", "customers", "owners"],
  },
  {
    id: "full",
    label: "Pełny",
    description: "Wszystkie elementy widoczne, pogrupowane tematycznie",
    sections: [
      { id: "main", itemIds: ["kokpit"] },
      { id: "rezerwacje", title: "REZERWACJE", itemIds: ["calendar", "reservations", "podnajem", "customers"], color: "cyan" },
      { id: "zarzadzanie", title: "ZARZĄDZANIE", itemIds: ["apartments", "owners", "tasks", "contracts-services", "przeglady"], color: "violet" },
      { id: "finanse", title: "FINANSE", itemIds: ["analizy", "source-comparison", "finance-forecast", "revenue", "koszty-apartamentowe", "koszty-operacyjne", "apartment-schedule", "salda", "invoices", "dokumenty-ksiegowe"], color: "emerald" },
    ],
  },
  {
    id: "finance",
    label: "Finanse",
    description: "Układ skupiony na finansach — rozbudowana sekcja finansowa, mniej rezerwacji",
    sections: [
      { id: "main", itemIds: ["kokpit"] },
      { id: "rezerwacje", title: "REZERWACJE", itemIds: ["calendar", "reservations"], color: "cyan" },
      { id: "finanse", title: "FINANSE", itemIds: ["revenue", "koszty-apartamentowe", "koszty-operacyjne", "analizy", "source-comparison", "finance-forecast", "apartment-schedule", "salda", "invoices", "dokumenty-ksiegowe", "contracts-services"], color: "emerald" },
      { id: "inne", title: "INNE", itemIds: ["apartments", "owners", "podnajem", "customers", "tasks", "przeglady"], color: "violet" },
    ],
  },
];

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Info, MinusCircle, Ban, Gavel, Handshake, Send, BookCheck, FileText, ShieldCheck, ShieldAlert, ShieldX, Timer, CircleDot, Pause, Award } from "lucide-react";

export type StatusCategory = "SUCCESS" | "WARNING" | "DANGER" | "INFO" | "NEUTRAL";

export interface StatusConfig {
  label: string;
  category: StatusCategory;
  icon: LucideIcon;
}

export const CATEGORY_STYLES: Record<StatusCategory, string> = {
  SUCCESS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  WARNING: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DANGER: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  INFO: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  NEUTRAL: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

export const STATUS_MAP: Record<string, StatusConfig> = {
  PRZYJETA: { label: "Przyjęta", category: "SUCCESS", icon: CheckCircle2 },
  OPLACONA: { label: "Opłacona", category: "SUCCESS", icon: CheckCircle2 },
  oplacona: { label: "Opłacona", category: "SUCCESS", icon: CheckCircle2 },
  OPLACONE: { label: "Opłacone", category: "SUCCESS", icon: CheckCircle2 },
  WYGRANA: { label: "Wygrana", category: "SUCCESS", icon: Award },
  AKTYWNA: { label: "Aktywna", category: "SUCCESS", icon: CheckCircle2 },
  AKTYWNY: { label: "Aktywny", category: "SUCCESS", icon: CheckCircle2 },
  ACTIVE: { label: "Aktywne", category: "SUCCESS", icon: CheckCircle2 },
  AKTUALNE: { label: "Aktualne", category: "SUCCESS", icon: ShieldCheck },
  ZAKSIEGOWANA: { label: "Zaksięgowana", category: "SUCCESS", icon: BookCheck },
  "ZAKSIĘGOWANA": { label: "Zaksięgowana", category: "SUCCESS", icon: BookCheck },

  DO_OPLACENIA: { label: "Do opłacenia", category: "WARNING", icon: AlertTriangle },
  do_oplacenia: { label: "Do opłacenia", category: "WARNING", icon: AlertTriangle },
  WYGASAJĄCE: { label: "Wygasa", category: "WARNING", icon: Timer },
  "KOŃCZĄCA_SIĘ": { label: "Kończąca się", category: "WARNING", icon: Timer },
  czesciowo: { label: "Częściowo", category: "WARNING", icon: Clock },

  ANULOWANA: { label: "Anulowana", category: "DANGER", icon: XCircle },
  PRZEGRANA: { label: "Przegrana", category: "DANGER", icon: XCircle },
  ERROR: { label: "Błąd", category: "DANGER", icon: XCircle },
  EXPIRED: { label: "Wygasło", category: "DANGER", icon: ShieldX },
  "WYGASŁE": { label: "Wygasło", category: "DANGER", icon: ShieldAlert },
  ZAKOŃCZONA: { label: "Zakończona", category: "DANGER", icon: MinusCircle },
  WYPOWIEDZIANA: { label: "Wypowiedziana", category: "DANGER", icon: Ban },

  W_TOKU: { label: "W toku", category: "INFO", icon: Clock },
  NOWA: { label: "Nowa", category: "INFO", icon: CircleDot },
  PENDING: { label: "Oczekuje", category: "INFO", icon: Clock },
  WYSLANA: { label: "Wysłana", category: "INFO", icon: Send },
  "WYSŁANA": { label: "Wysłana", category: "INFO", icon: Send },

  ZAWIESZONA: { label: "Zawieszona", category: "NEUTRAL", icon: Pause },
  ZAKONCZONA: { label: "Zakończona", category: "NEUTRAL", icon: MinusCircle },
  UGODA: { label: "Ugoda", category: "NEUTRAL", icon: Handshake },
  NIEAKTYWNY: { label: "Nieaktywny", category: "NEUTRAL", icon: MinusCircle },
  archiwalna: { label: "Archiwalna", category: "NEUTRAL", icon: MinusCircle },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || {
    label: status,
    category: "NEUTRAL" as StatusCategory,
    icon: Info,
  };
}

export function getStatusStyle(status: string): string {
  const config = getStatusConfig(status);
  return CATEGORY_STYLES[config.category];
}

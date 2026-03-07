import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Receipt, FileSignature, Download } from "lucide-react";
import { ReservationForm } from "@/pages/Reservations";

export function QuickActions() {
  const [, navigate] = useLocation();
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const actions = [
    { label: "Nowa rezerwacja", shortLabel: "Rezerwacja", icon: Plus, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", action: () => setShowReservationDialog(true), testId: "button-quick-reservation" },
    { label: "Nowy wydatek", shortLabel: "Wydatek", icon: Receipt, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", action: () => navigate("/koszty-operacyjne?action=new"), testId: "button-quick-expense" },
    { label: "Nowy podnajem", shortLabel: "Podnajem", icon: FileSignature, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", action: () => navigate("/podnajem?action=new"), testId: "button-quick-sublease" },
    { label: "Dodaj fakturę", shortLabel: "Faktura", icon: Receipt, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", action: () => navigate("/dokumenty-ksiegowe"), testId: "button-quick-cost-invoice" },
    { label: "Backup danych", shortLabel: "Backup", icon: Download, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", action: () => navigate("/import-export"), testId: "button-quick-backup" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {actions.map(a => (
          <Card key={a.testId} className="hover-elevate cursor-pointer" onClick={a.action} data-testid={a.testId}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-md ${a.bg} flex items-center justify-center shrink-0`}>
                <a.icon className={`h-4 w-4 ${a.color}`} />
              </div>
              <span className="text-sm font-medium">
                <span className="hidden sm:inline">{a.label}</span>
                <span className="sm:hidden">{a.shortLabel}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nowa rezerwacja</DialogTitle>
          </DialogHeader>
          <ReservationForm onSuccess={() => { setShowReservationDialog(false); navigate("/reservations"); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

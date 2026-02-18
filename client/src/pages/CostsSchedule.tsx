import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CostSchedule, CostSchedulePayment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Calendar, CheckCircle2, XCircle, ChevronDown, ChevronRight, CalendarPlus } from "lucide-react";
import { format, addMonths, addQuarters, addYears, parseISO, isBefore, isAfter, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

const CATEGORIES = [
  "WYNAGRODZENIA",
  "ZUS & PODATKI",
  "KREDYTY & POŻYCZKI",
  "NIERUCHOMOŚCI",
  "OBSŁUGA PRAWNO-KSIĘGOWA",
  "MARKETING & REKLAMA",
  "USŁUGI",
  "POZOSTAŁE",
];

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "monthly", label: "Miesięcznie" },
  { value: "quarterly", label: "Kwartalnie" },
  { value: "yearly", label: "Rocznie" },
  { value: "one_time", label: "Jednorazowo" },
];

function formatNum(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "0,00";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function freqLabel(f: string): string {
  return FREQUENCIES.find(x => x.value === f)?.label || f;
}

function generatePaymentDates(startDate: string, endDate: string | null, frequency: string): string[] {
  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = endDate ? parseISO(endDate) : addYears(new Date(), 2);

  if (frequency === "one_time") {
    return [startDate];
  }

  while (!isAfter(current, end) && dates.length < 120) {
    dates.push(format(current, "yyyy-MM-dd"));
    if (frequency === "monthly") current = addMonths(current, 1);
    else if (frequency === "quarterly") current = addQuarters(current, 1);
    else if (frequency === "yearly") current = addYears(current, 1);
    else break;
  }
  return dates;
}

export default function CostsSchedule() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editSchedule, setEditSchedule] = useState<CostSchedule | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<CostSchedule[]>({
    queryKey: ["/api/cost-schedules"],
  });

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery<CostSchedulePayment[]>({
    queryKey: ["/api/cost-schedule-payments"],
  });

  const createSchedule = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/cost-schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      setShowAddDialog(false);
      toast({ title: "Dodano harmonogram kosztów" });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/cost-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      setEditSchedule(null);
      toast({ title: "Zaktualizowano harmonogram" });
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cost-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
      toast({ title: "Usunięto harmonogram" });
    },
  });

  const createPayment = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/cost-schedule-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/cost-schedule-payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cost-schedule-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const paymentsBySchedule = useMemo(() => {
    const map: Record<number, CostSchedulePayment[]> = {};
    for (const p of allPayments) {
      if (!map[p.scheduleId]) map[p.scheduleId] = [];
      map[p.scheduleId].push(p);
    }
    return map;
  }, [allPayments]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (filterStatus === "active" && !s.active) return false;
      if (filterStatus === "inactive" && s.active) return false;
      return true;
    });
  }, [schedules, filterCategory, filterStatus]);

  const summaryStats = useMemo(() => {
    const activeSchedules = schedules.filter(s => s.active);
    const monthlyTotal = activeSchedules.reduce((sum, s) => {
      const amt = parseFloat(s.amount || "0");
      if (s.frequency === "monthly") return sum + amt;
      if (s.frequency === "quarterly") return sum + amt / 3;
      if (s.frequency === "yearly") return sum + amt / 12;
      return sum;
    }, 0);
    const paidCount = allPayments.filter(p => p.status === "OPLACONE").length;
    const unpaidCount = allPayments.filter(p => p.status === "NIEOPLACONE").length;
    const totalPaid = allPayments
      .filter(p => p.status === "OPLACONE")
      .reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    return { monthlyTotal, paidCount, unpaidCount, totalPaid, total: activeSchedules.length };
  }, [schedules, allPayments]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGeneratePayments = async (schedule: CostSchedule) => {
    const existing = paymentsBySchedule[schedule.id] || [];
    const existingDates = new Set(existing.map(p => p.dueDate));
    const dates = generatePaymentDates(schedule.startDate, schedule.endDate, schedule.frequency);
    const newDates = dates.filter(d => !existingDates.has(d));

    if (newDates.length === 0) {
      toast({ title: "Brak nowych terminów do wygenerowania" });
      return;
    }

    for (const dueDate of newDates) {
      await createPayment.mutateAsync({
        scheduleId: schedule.id,
        dueDate,
        amount: schedule.amount,
        status: "NIEOPLACONE",
      });
    }
    toast({ title: `Wygenerowano ${newDates.length} płatności` });
  };

  const handleTogglePaymentStatus = (payment: CostSchedulePayment) => {
    const newStatus = payment.status === "OPLACONE" ? "NIEOPLACONE" : "OPLACONE";
    updatePayment.mutate({
      id: payment.id,
      data: {
        status: newStatus,
        paidDate: newStatus === "OPLACONE" ? format(new Date(), "yyyy-MM-dd") : null,
      },
    });
  };

  if (schedulesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Koszty - Harmonogram</h2>
          <p className="text-muted-foreground text-sm mt-1">Planowanie i śledzenie cyklicznych kosztów</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-schedule">
          <Plus className="w-4 h-4 mr-1" />
          Dodaj koszt
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Koszty miesięczne</p>
            <p className="text-xl font-bold mt-1" data-testid="text-monthly-total">{formatNum(summaryStats.monthlyTotal)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Aktywne harmonogramy</p>
            <p className="text-xl font-bold mt-1" data-testid="text-active-count">{summaryStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Opłacone</p>
            <p className="text-xl font-bold mt-1 text-green-600" data-testid="text-paid-count">{summaryStats.paidCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Do opłacenia</p>
            <p className="text-xl font-bold mt-1 text-red-600" data-testid="text-unpaid-count">{summaryStats.unpaidCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48" data-testid="select-filter-category">
            <SelectValue placeholder="Kategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="active">Aktywne</SelectItem>
            <SelectItem value="inactive">Nieaktywne</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredSchedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {schedules.length === 0
              ? "Brak harmonogramów kosztów. Dodaj pierwszy koszt cykliczny."
              : "Brak harmonogramów pasujących do filtrów."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map(schedule => {
            const payments = paymentsBySchedule[schedule.id] || [];
            const isExpanded = expandedIds.has(schedule.id);
            const paidCount = payments.filter(p => p.status === "OPLACONE").length;
            const unpaidOverdue = payments.filter(
              p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), new Date())
            ).length;

            return (
              <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => toggleExpand(schedule.id)}
                      className="p-1"
                      data-testid={`button-expand-${schedule.id}`}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" data-testid={`text-schedule-name-${schedule.id}`}>{schedule.name}</span>
                        <Badge variant="secondary" className="text-xs">{schedule.category}</Badge>
                        <Badge variant="outline" className="text-xs">{freqLabel(schedule.frequency)}</Badge>
                        {!schedule.active && <Badge variant="destructive" className="text-xs">Nieaktywny</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatNum(schedule.amount)} zł</span>
                        <span>od {schedule.startDate}</span>
                        {schedule.endDate && <span>do {schedule.endDate}</span>}
                        {payments.length > 0 && (
                          <span>{paidCount}/{payments.length} opłaconych</span>
                        )}
                        {unpaidOverdue > 0 && (
                          <span className="text-red-600 font-medium">{unpaidOverdue} zaległych</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleGeneratePayments(schedule)}
                        title="Generuj płatności"
                        data-testid={`button-generate-${schedule.id}`}
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditSchedule(schedule)}
                        data-testid={`button-edit-${schedule.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Usunąć ten harmonogram i wszystkie powiązane płatności?")) {
                            deleteSchedule.mutate(schedule.id);
                          }
                        }}
                        data-testid={`button-delete-${schedule.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t pt-3">
                      {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Brak wygenerowanych płatności. Kliknij ikonę kalendarza, aby wygenerować.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="py-2 px-2 font-medium text-muted-foreground">Termin</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Kwota</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Status</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Data opłacenia</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground w-20"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map(payment => {
                                const isOverdue = payment.status === "NIEOPLACONE" && isBefore(parseISO(payment.dueDate), new Date());
                                return (
                                  <tr
                                    key={payment.id}
                                    className={`border-b last:border-0 ${isOverdue ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                                    data-testid={`row-payment-${payment.id}`}
                                  >
                                    <td className="py-2 px-2">
                                      <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                        {format(parseISO(payment.dueDate), "dd.MM.yyyy")}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 font-medium">{formatNum(payment.amount)} zł</td>
                                    <td className="py-2 px-2">
                                      <button
                                        onClick={() => handleTogglePaymentStatus(payment)}
                                        data-testid={`button-toggle-status-${payment.id}`}
                                      >
                                        {payment.status === "OPLACONE" ? (
                                          <Badge className="bg-green-600 text-white text-xs no-default-hover-elevate no-default-active-elevate">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            OPŁACONE
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive" className="text-xs no-default-hover-elevate no-default-active-elevate">
                                            <XCircle className="w-3 h-3 mr-1" />
                                            NIEOPŁACONE
                                          </Badge>
                                        )}
                                      </button>
                                    </td>
                                    <td className="py-2 px-2 text-muted-foreground">
                                      {payment.paidDate ? format(parseISO(payment.paidDate), "dd.MM.yyyy") : "—"}
                                    </td>
                                    <td className="py-2 px-2">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          if (confirm("Usunąć tę płatność?")) deletePayment.mutate(payment.id);
                                        }}
                                        data-testid={`button-delete-payment-${payment.id}`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ScheduleDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={(data) => createSchedule.mutate(data)}
        isPending={createSchedule.isPending}
        title="Dodaj harmonogram kosztów"
      />

      {editSchedule && (
        <ScheduleDialog
          open={!!editSchedule}
          onOpenChange={(open) => { if (!open) setEditSchedule(null); }}
          onSave={(data) => updateSchedule.mutate({ id: editSchedule.id, data })}
          isPending={updateSchedule.isPending}
          title="Edytuj harmonogram"
          initial={editSchedule}
        />
      )}
    </div>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  onSave,
  isPending,
  title,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
  title: string;
  initial?: CostSchedule;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [amount, setAmount] = useState(initial?.amount || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "monthly");
  const [startDate, setStartDate] = useState(initial?.startDate || format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [active, setActive] = useState(initial?.active !== false);

  const handleSubmit = () => {
    if (!name || !amount || !startDate) return;
    onSave({
      name,
      category,
      amount,
      frequency,
      startDate,
      endDate: endDate || null,
      notes: notes || null,
      active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Czynsz biuro, ZUS..."
              data-testid="input-schedule-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kategoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-schedule-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Częstotliwość</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger data-testid="select-schedule-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Kwota (zł)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-schedule-amount"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data rozpoczęcia</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-schedule-start"
              />
            </div>
            <div className="space-y-1">
              <Label>Data zakończenia</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-schedule-end"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notatki</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-schedule-notes"
            />
          </div>
          {initial && (
            <div className="flex items-center gap-2">
              <Label>Aktywny</Label>
              <Button
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setActive(!active)}
                data-testid="button-toggle-active"
              >
                {active ? "Tak" : "Nie"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name || !amount || !startDate}
            data-testid="button-save-schedule"
          >
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InstallmentSchedule as InstSchedule, InstallmentPayment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, CheckCircle2, XCircle, ChevronDown, ChevronRight, CalendarPlus } from "lucide-react";
import { format, addMonths, parseISO, isBefore } from "date-fns";

const CATEGORIES = [
  "KREDYT",
  "POŻYCZKA",
  "LEASING",
  "SUBWENCJA",
  "INNE",
];

function formatNum(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "0,00";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InstallmentSchedulePage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editSchedule, setEditSchedule] = useState<InstSchedule | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<InstSchedule[]>({
    queryKey: ["/api/installment-schedules"],
  });

  const { data: allPayments = [] } = useQuery<InstallmentPayment[]>({
    queryKey: ["/api/installment-payments"],
  });

  const createSchedule = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/installment-schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-schedules"] });
      setShowAddDialog(false);
      toast({ title: "Dodano harmonogram rat" });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/installment-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-schedules"] });
      setEditSchedule(null);
      toast({ title: "Zaktualizowano harmonogram" });
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/installment-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/installment-payments"] });
      toast({ title: "Usunięto harmonogram" });
    },
  });

  const createPayment = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/installment-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-payments"] });
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/installment-payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-payments"] });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/installment-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installment-payments"] });
    },
  });

  const paymentsBySchedule = useMemo(() => {
    const map: Record<number, InstallmentPayment[]> = {};
    for (const p of allPayments) {
      if (!map[p.scheduleId]) map[p.scheduleId] = [];
      map[p.scheduleId].push(p);
    }
    return map;
  }, [allPayments]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      return true;
    });
  }, [schedules, filterCategory]);

  const summaryStats = useMemo(() => {
    const totalDebt = schedules.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
    const monthlyPayments = schedules
      .filter(s => s.active)
      .reduce((sum, s) => sum + parseFloat(s.installmentAmount || "0"), 0);
    const paidPayments = allPayments.filter(p => p.status === "OPLACONE");
    const totalPaid = paidPayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    const remaining = totalDebt - totalPaid;
    const overdueCount = allPayments.filter(
      p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), new Date())
    ).length;
    return { totalDebt, monthlyPayments, totalPaid, remaining, overdueCount };
  }, [schedules, allPayments]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGeneratePayments = async (schedule: InstSchedule) => {
    const existing = paymentsBySchedule[schedule.id] || [];
    const existingNums = new Set(existing.map(p => p.installmentNumber));
    const startDate = parseISO(schedule.startDate);
    let generated = 0;

    for (let i = 1; i <= schedule.numberOfInstallments; i++) {
      if (existingNums.has(i)) continue;
      const dueDate = format(addMonths(startDate, i - 1), "yyyy-MM-dd");
      await createPayment.mutateAsync({
        scheduleId: schedule.id,
        installmentNumber: i,
        dueDate,
        amount: schedule.installmentAmount,
        status: "NIEOPLACONE",
      });
      generated++;
    }

    if (generated === 0) {
      toast({ title: "Wszystkie raty zostały już wygenerowane" });
    } else {
      toast({ title: `Wygenerowano ${generated} rat` });
    }
  };

  const handleTogglePaymentStatus = (payment: InstallmentPayment) => {
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
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Raty - Harmonogram</h2>
          <p className="text-muted-foreground text-sm mt-1">Harmonogram spłat kredytów, pożyczek i leasingów</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-installment">
          <Plus className="w-4 h-4 mr-1" />
          Dodaj zobowiązanie
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Łączne zobowiązania</p>
            <p className="text-lg font-bold mt-1" data-testid="text-total-debt">{formatNum(summaryStats.totalDebt)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Rata miesięczna</p>
            <p className="text-lg font-bold mt-1" data-testid="text-monthly-payment">{formatNum(summaryStats.monthlyPayments)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Spłacono</p>
            <p className="text-lg font-bold mt-1 text-green-600" data-testid="text-total-paid">{formatNum(summaryStats.totalPaid)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Pozostało</p>
            <p className="text-lg font-bold mt-1 text-amber-600" data-testid="text-remaining">{formatNum(summaryStats.remaining)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Zaległe raty</p>
            <p className="text-lg font-bold mt-1 text-red-600" data-testid="text-overdue">{summaryStats.overdueCount}</p>
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
      </div>

      {filteredSchedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {schedules.length === 0
              ? "Brak harmonogramów rat. Dodaj pierwsze zobowiązanie."
              : "Brak harmonogramów pasujących do filtrów."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map(schedule => {
            const payments = (paymentsBySchedule[schedule.id] || [])
              .sort((a, b) => a.installmentNumber - b.installmentNumber);
            const isExpanded = expandedIds.has(schedule.id);
            const paidCount = payments.filter(p => p.status === "OPLACONE").length;
            const paidAmount = payments
              .filter(p => p.status === "OPLACONE")
              .reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
            const progressPct = schedule.numberOfInstallments > 0
              ? Math.round((paidCount / schedule.numberOfInstallments) * 100)
              : 0;
            const overdueCount = payments.filter(
              p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), new Date())
            ).length;

            return (
              <Card key={schedule.id} data-testid={`card-installment-${schedule.id}`}>
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
                        {!schedule.active && <Badge variant="destructive" className="text-xs">Zakończony</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Łącznie: {formatNum(schedule.totalAmount)} zł</span>
                        <span>Rata: {formatNum(schedule.installmentAmount)} zł</span>
                        <span>{schedule.numberOfInstallments} rat</span>
                        {schedule.interestRate && <span>Oprocentowanie: {schedule.interestRate}%</span>}
                        {overdueCount > 0 && (
                          <span className="text-red-600 font-medium">{overdueCount} zaległych</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{paidCount}/{schedule.numberOfInstallments} ({progressPct}%)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleGeneratePayments(schedule)}
                        title="Generuj raty"
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
                          if (confirm("Usunąć to zobowiązanie i wszystkie powiązane raty?")) {
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
                          Brak wygenerowanych rat. Kliknij ikonę kalendarza, aby wygenerować harmonogram spłat.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="py-2 px-2 font-medium text-muted-foreground w-12">Nr</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Termin</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Kwota</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Kapitał</th>
                                <th className="py-2 px-2 font-medium text-muted-foreground">Odsetki</th>
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
                                    <td className="py-2 px-2 text-muted-foreground">{payment.installmentNumber}</td>
                                    <td className="py-2 px-2">
                                      <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                        {format(parseISO(payment.dueDate), "dd.MM.yyyy")}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 font-medium">{formatNum(payment.amount)} zł</td>
                                    <td className="py-2 px-2 text-muted-foreground">
                                      {payment.principalAmount ? `${formatNum(payment.principalAmount)} zł` : "—"}
                                    </td>
                                    <td className="py-2 px-2 text-muted-foreground">
                                      {payment.interestAmount ? `${formatNum(payment.interestAmount)} zł` : "—"}
                                    </td>
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
                                          if (confirm("Usunąć tę ratę?")) deletePayment.mutate(payment.id);
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

                          <div className="mt-3 flex flex-wrap gap-4 text-sm p-3 bg-muted/50 rounded-md">
                            <span>Spłacono: <strong className="text-green-600">{formatNum(paidAmount)} zł</strong></span>
                            <span>Pozostało: <strong className="text-amber-600">{formatNum(parseFloat(schedule.totalAmount || "0") - paidAmount)} zł</strong></span>
                          </div>
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

      <InstallmentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={(data) => createSchedule.mutate(data)}
        isPending={createSchedule.isPending}
        title="Dodaj zobowiązanie"
      />

      {editSchedule && (
        <InstallmentDialog
          open={!!editSchedule}
          onOpenChange={(open) => { if (!open) setEditSchedule(null); }}
          onSave={(data) => updateSchedule.mutate({ id: editSchedule.id, data })}
          isPending={updateSchedule.isPending}
          title="Edytuj zobowiązanie"
          initial={editSchedule}
        />
      )}
    </div>
  );
}

function InstallmentDialog({
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
  initial?: InstSchedule;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount || "");
  const [installmentAmount, setInstallmentAmount] = useState(initial?.installmentAmount || "");
  const [numberOfInstallments, setNumberOfInstallments] = useState(String(initial?.numberOfInstallments || ""));
  const [startDate, setStartDate] = useState(initial?.startDate || format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [interestRate, setInterestRate] = useState(initial?.interestRate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [active, setActive] = useState(initial?.active !== false);

  const handleSubmit = () => {
    if (!name || !totalAmount || !installmentAmount || !numberOfInstallments || !startDate) return;
    onSave({
      name,
      category,
      totalAmount,
      installmentAmount,
      numberOfInstallments: parseInt(numberOfInstallments),
      startDate,
      endDate: endDate || null,
      interestRate: interestRate || null,
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
              placeholder="np. Leasing Audi Q7, Pożyczka PFP..."
              data-testid="input-installment-name"
            />
          </div>
          <div className="space-y-1">
            <Label>Kategoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-installment-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kwota łączna (zł)</Label>
              <Input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                data-testid="input-total-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Kwota raty (zł)</Label>
              <Input
                type="number"
                step="0.01"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                data-testid="input-installment-amount"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Liczba rat</Label>
              <Input
                type="number"
                value={numberOfInstallments}
                onChange={(e) => setNumberOfInstallments(e.target.value)}
                data-testid="input-num-installments"
              />
            </div>
            <div className="space-y-1">
              <Label>Oprocentowanie (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                data-testid="input-interest-rate"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data rozpoczęcia</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Data zakończenia</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notatki</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-installment-notes"
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
            disabled={isPending || !name || !totalAmount || !installmentAmount || !numberOfInstallments || !startDate}
            data-testid="button-save-installment"
          >
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

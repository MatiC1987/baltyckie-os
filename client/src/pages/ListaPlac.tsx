import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Banknote, Plus, Play, CheckCircle, Trash2, Pencil, Users, DollarSign, Receipt } from "lucide-react";
import type { PayrollPeriod, PayrollEntry, Employee } from "@shared/schema";

const MONTHS = [
  { value: "1", label: "Styczeń" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecień" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpień" },
  { value: "9", label: "Wrzesień" },
  { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzień" },
];

function getMonthName(m: number) {
  return MONTHS.find((mo) => mo.value === String(m))?.label ?? String(m);
}

function formatCurrency(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}

function statusBadge(status: string) {
  switch (status) {
    case "OTWARTY":
      return <Badge variant="outline" data-testid="badge-status-open">Otwarty</Badge>;
    case "WYGENEROWANY":
      return <Badge variant="secondary" data-testid="badge-status-generated">Wygenerowany</Badge>;
    case "ZATWIERDZONY":
      return <Badge data-testid="badge-status-approved">Zatwierdzony</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ListaPlac() {
  const { toast } = useToast();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditEntryDialog, setShowEditEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [createMonth, setCreateMonth] = useState(String(new Date().getMonth() + 1));
  const [createYear, setCreateYear] = useState(String(new Date().getFullYear()));

  const { data: periods = [], isLoading: periodsLoading } = useQuery<PayrollPeriod[]>({
    queryKey: ["/api/payroll-periods"],
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll-entries", selectedPeriodId],
    queryFn: async () => {
      const res = await fetch(`/api/payroll-entries/${selectedPeriodId}`);
      if (!res.ok) throw new Error("Błąd pobierania wpisów");
      return res.json();
    },
    enabled: !!selectedPeriodId,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const createPeriodMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      const res = await apiRequest("POST", "/api/payroll-periods", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-periods"] });
      setShowCreateDialog(false);
      toast({ title: "Utworzono okres rozliczeniowy" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const period = periods.find((p) => p.id === periodId);
      if (!period) throw new Error("Nie znaleziono okresu");
      const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
      const lastDay = new Date(period.year, period.month, 0).getDate();
      const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const res = await apiRequest("POST", `/api/payroll-periods/${periodId}/generate`, { startDate, endDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-periods"] });
      if (selectedPeriodId) {
        queryClient.invalidateQueries({ queryKey: ["/api/payroll-entries", String(selectedPeriodId)] });
      }
      toast({ title: "Wygenerowano listę płac" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd generowania", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await apiRequest("PATCH", `/api/payroll-periods/${periodId}`, { status: "ZATWIERDZONY" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-periods"] });
      toast({ title: "Okres zatwierdzony" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deletePeriodMutation = useMutation({
    mutationFn: async (periodId: number) => {
      await apiRequest("DELETE", `/api/payroll-periods/${periodId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-periods"] });
      if (selectedPeriodId) setSelectedPeriodId(null);
      toast({ title: "Usunięto okres" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PayrollEntry> }) => {
      const res = await apiRequest("PATCH", `/api/payroll-entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedPeriodId) {
        queryClient.invalidateQueries({ queryKey: ["/api/payroll-entries", String(selectedPeriodId)] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-periods"] });
      setShowEditEntryDialog(false);
      setEditingEntry(null);
      toast({ title: "Zaktualizowano wpis" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const totalGross = entries.reduce((s, e) => s + parseFloat(String(e.grossPay || "0")), 0);
  const totalNet = entries.reduce((s, e) => s + parseFloat(String(e.netPay || "0")), 0);
  const employeeCount = entries.length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Lista Płac"
        description="Zarządzanie listami płac i wynagrodzeniami pracowników"
        icon={Banknote}
        actions={
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-period">
            <Plus className="h-4 w-4 mr-2" />
            Nowy okres
          </Button>
        }
      />

      {selectedPeriod && entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Brutto łącznie</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-gross">{formatCurrency(totalGross)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Netto łącznie</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-net">{formatCurrency(totalNet)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pracownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-employee-count">{employeeCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Okresy rozliczeniowe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {periodsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : periods.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-periods">Brak okresów rozliczeniowych</p>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  className={`flex items-center justify-between gap-2 p-3 rounded-md cursor-pointer hover-elevate ${
                    selectedPeriodId === period.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedPeriodId(period.id)}
                  data-testid={`period-item-${period.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {getMonthName(period.month)} {period.year}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(period.totalGross)} brutto
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {statusBadge(period.status)}
                    {period.status === "OTWARTY" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); generateMutation.mutate(period.id); }}
                        data-testid={`button-generate-${period.id}`}
                        disabled={generateMutation.isPending}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {(period.status === "WYGENEROWANY") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); approveMutation.mutate(period.id); }}
                        data-testid={`button-approve-${period.id}`}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {period.status !== "ZATWIERDZONY" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); deletePeriodMutation.mutate(period.id); }}
                        data-testid={`button-delete-period-${period.id}`}
                        disabled={deletePeriodMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedPeriod
                ? `${getMonthName(selectedPeriod.month)} ${selectedPeriod.year} - Wpisy`
                : "Wybierz okres"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedPeriodId ? (
              <p className="text-sm text-muted-foreground" data-testid="text-select-period">
                Wybierz okres rozliczeniowy z listy po lewej stronie
              </p>
            ) : entriesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full mb-2" />
              ))
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-entries">
                Brak wpisów. Wygeneruj listę płac dla tego okresu.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pracownik</TableHead>
                      <TableHead className="text-right">Godziny</TableHead>
                      <TableHead className="text-right">Nadgodziny</TableHead>
                      <TableHead className="text-right">Stawka/h</TableHead>
                      <TableHead className="text-right">Podstawa</TableHead>
                      <TableHead className="text-right">Premia</TableHead>
                      <TableHead className="text-right">Potrącenia</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const emp = employeeMap.get(entry.employeeId);
                      return (
                        <TableRow key={entry.id} data-testid={`entry-row-${entry.id}`}>
                          <TableCell className="font-medium">
                            {emp ? `${emp.firstName} ${emp.lastName}` : `Pracownik #${entry.employeeId}`}
                          </TableCell>
                          <TableCell className="text-right">{entry.totalHours}</TableCell>
                          <TableCell className="text-right">{entry.overtimeHours}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.hourlyRate)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.basePay)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.bonus)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.deductions)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(entry.grossPay)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(entry.netPay)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setEditingEntry(entry); setShowEditEntryDialog(true); }}
                              data-testid={`button-edit-entry-${entry.id}`}
                              disabled={selectedPeriod?.status === "ZATWIERDZONY"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy okres rozliczeniowy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Miesiąc</Label>
              <Select value={createMonth} onValueChange={setCreateMonth}>
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rok</Label>
              <Input
                type="number"
                value={createYear}
                onChange={(e) => setCreateYear(e.target.value)}
                data-testid="input-year"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">
              Anuluj
            </Button>
            <Button
              onClick={() => createPeriodMutation.mutate({ month: parseInt(createMonth), year: parseInt(createYear) })}
              disabled={createPeriodMutation.isPending}
              data-testid="button-confirm-create"
            >
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditEntryDialog} onOpenChange={(open) => { setShowEditEntryDialog(open); if (!open) setEditingEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj wpis</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <EditEntryForm
              entry={editingEntry}
              onSave={(data) => updateEntryMutation.mutate({ id: editingEntry.id, data })}
              isPending={updateEntryMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditEntryForm({
  entry,
  onSave,
  isPending,
}: {
  entry: PayrollEntry;
  onSave: (data: Partial<PayrollEntry>) => void;
  isPending: boolean;
}) {
  const [bonus, setBonus] = useState(String(entry.bonus || "0"));
  const [deductions, setDeductions] = useState(String(entry.deductions || "0"));
  const [notes, setNotes] = useState(entry.notes || "");

  const basePay = parseFloat(String(entry.basePay || "0"));
  const overtimePay = parseFloat(String(entry.overtimePay || "0"));
  const bonusVal = parseFloat(bonus || "0");
  const deductionsVal = parseFloat(deductions || "0");
  const grossPay = basePay + overtimePay + bonusVal - deductionsVal;
  const netPay = Math.round(grossPay * 0.77 * 100) / 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Podstawa</Label>
          <div className="text-sm font-medium">{formatCurrency(entry.basePay)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Za nadgodziny</Label>
          <div className="text-sm font-medium">{formatCurrency(entry.overtimePay)}</div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Premia</Label>
        <Input
          type="number"
          step="0.01"
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          data-testid="input-bonus"
        />
      </div>
      <div className="space-y-2">
        <Label>Potrącenia</Label>
        <Input
          type="number"
          step="0.01"
          value={deductions}
          onChange={(e) => setDeductions(e.target.value)}
          data-testid="input-deductions"
        />
      </div>
      <div className="space-y-2">
        <Label>Uwagi</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="input-notes"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Brutto (wyliczone)</Label>
          <div className="text-sm font-bold" data-testid="text-calculated-gross">{formatCurrency(grossPay)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Netto (wyliczone)</Label>
          <div className="text-sm font-bold" data-testid="text-calculated-net">{formatCurrency(netPay)}</div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSave({
              bonus: String(bonusVal),
              deductions: String(deductionsVal),
              notes,
              grossPay: String(grossPay),
              netPay: String(netPay),
            })
          }
          disabled={isPending}
          data-testid="button-save-entry"
        >
          Zapisz
        </Button>
      </DialogFooter>
    </div>
  );
}

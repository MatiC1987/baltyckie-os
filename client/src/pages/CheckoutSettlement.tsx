import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Plus, Pencil, Trash2, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CheckoutSettlement, Sublease } from "@shared/schema";

function fmt(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcBalance(f: FormValues): number {
  return (
    Number(f.depositAmount || 0) -
    Number(f.depositReturned || 0) -
    Number(f.depositDeductions || 0) -
    Number(f.outstandingRent || 0) -
    Number(f.mediaCost || 0) -
    Number(f.damageCost || 0) -
    Number(f.otherCosts || 0)
  );
}

interface FormValues {
  subleaseId: number | "";
  settlementDate: string;
  depositAmount: string;
  depositReturned: string;
  depositDeductions: string;
  outstandingRent: string;
  mediaCost: string;
  damageCost: string;
  otherCosts: string;
  notes: string;
  damageDescription: string;
  status: string;
}

const defaultForm: FormValues = {
  subleaseId: "",
  settlementDate: new Date().toISOString().slice(0, 10),
  depositAmount: "0",
  depositReturned: "0",
  depositDeductions: "0",
  outstandingRent: "0",
  mediaCost: "0",
  damageCost: "0",
  otherCosts: "0",
  notes: "",
  damageDescription: "",
  status: "SZKIC",
};

function subleaseName(s: Sublease): string {
  if (s.companyName) return s.companyName;
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || `Podnajem #${s.id}`;
}

export default function CheckoutSettlementPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<CheckoutSettlement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormValues>(defaultForm);

  const { data: settlements = [], isLoading } = useQuery<CheckoutSettlement[]>({
    queryKey: ["/api/checkout-settlements"],
  });

  const { data: subleases = [] } = useQuery<Sublease[]>({
    queryKey: ["/api/subleases"],
  });

  const subleasesMap = useMemo(() => {
    const m = new Map<number, Sublease>();
    subleases.forEach((s) => m.set(s.id, s));
    return m;
  }, [subleases]);

  const createMut = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", "/api/checkout-settlements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkout-settlements"] });
      toast({ title: "Rozliczenie utworzone" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      apiRequest("PATCH", `/api/checkout-settlements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkout-settlements"] });
      toast({ title: "Rozliczenie zaktualizowane" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/checkout-settlements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkout-settlements"] });
      toast({ title: "Rozliczenie usunięte" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(s: CheckoutSettlement) {
    setEditingId(s.id);
    setForm({
      subleaseId: s.subleaseId,
      settlementDate: s.settlementDate,
      depositAmount: s.depositAmount ?? "0",
      depositReturned: s.depositReturned ?? "0",
      depositDeductions: s.depositDeductions ?? "0",
      outstandingRent: s.outstandingRent ?? "0",
      mediaCost: s.mediaCost ?? "0",
      damageCost: s.damageCost ?? "0",
      otherCosts: s.otherCosts ?? "0",
      notes: s.notes ?? "",
      damageDescription: s.damageDescription ?? "",
      status: s.status,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subleaseId) {
      toast({ title: "Wybierz podnajem", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      subleaseId: Number(form.subleaseId),
      finalBalance: String(calcBalance(form).toFixed(2)),
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function setField(key: keyof FormValues, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filtered = settlements.filter((s) => {
    if (!search) return true;
    const sub = subleasesMap.get(s.subleaseId);
    const name = sub ? subleaseName(sub) : "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const finalBalance = calcBalance(form);
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Rozliczenia wykwaterowania"
        description="Rozliczenia kaucji i kosztów przy wykwaterowaniu"
        icon={ClipboardCheck}
        actions={
          <Button onClick={openCreate} data-testid="button-create-settlement">
            <Plus className="w-4 h-4 mr-2" />
            Nowe rozliczenie
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po najemcy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-settlements"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-settlements">
            Brak rozliczeń
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Najemca</TableHead>
                  <TableHead>Data rozliczenia</TableHead>
                  <TableHead className="text-right">Kaucja</TableHead>
                  <TableHead className="text-right">Saldo końcowe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const sub = subleasesMap.get(s.subleaseId);
                  return (
                    <TableRow key={s.id} data-testid={`row-settlement-${s.id}`}>
                      <TableCell data-testid={`text-tenant-${s.id}`}>
                        {sub ? subleaseName(sub) : `#${s.subleaseId}`}
                      </TableCell>
                      <TableCell>{s.settlementDate}</TableCell>
                      <TableCell className="text-right">{fmt(s.depositAmount)} zł</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={Number(s.finalBalance ?? 0) < 0 ? "text-red-600" : ""}>
                          {fmt(s.finalBalance)} zł
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "ZATWIERDZONY" ? "default" : "secondary"}
                          data-testid={`badge-status-${s.id}`}
                        >
                          {s.status === "ZATWIERDZONY" ? "Zatwierdzony" : "Szkic"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDetailDialog(s)}
                            data-testid={`button-view-${s.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(s)}
                            data-testid={`button-edit-${s.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMut.mutate(s.id)}
                            data-testid={`button-delete-${s.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingId ? "Edytuj rozliczenie" : "Nowe rozliczenie"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Podnajem</Label>
                <Select
                  value={form.subleaseId ? String(form.subleaseId) : ""}
                  onValueChange={(v) => setField("subleaseId", Number(v))}
                >
                  <SelectTrigger data-testid="select-sublease">
                    <SelectValue placeholder="Wybierz podnajem" />
                  </SelectTrigger>
                  <SelectContent>
                    {subleases.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {subleaseName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data rozliczenia</Label>
                <Input
                  type="date"
                  value={form.settlementDate}
                  onChange={(e) => setField("settlementDate", e.target.value)}
                  data-testid="input-settlement-date"
                />
              </div>

              <div className="space-y-2">
                <Label>Kwota kaucji</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.depositAmount}
                  onChange={(e) => setField("depositAmount", e.target.value)}
                  data-testid="input-deposit-amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Kaucja zwrócona</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.depositReturned}
                  onChange={(e) => setField("depositReturned", e.target.value)}
                  data-testid="input-deposit-returned"
                />
              </div>

              <div className="space-y-2">
                <Label>Potrącenia z kaucji</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.depositDeductions}
                  onChange={(e) => setField("depositDeductions", e.target.value)}
                  data-testid="input-deposit-deductions"
                />
              </div>

              <div className="space-y-2">
                <Label>Zaległy czynsz</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.outstandingRent}
                  onChange={(e) => setField("outstandingRent", e.target.value)}
                  data-testid="input-outstanding-rent"
                />
              </div>

              <div className="space-y-2">
                <Label>Koszt mediów</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.mediaCost}
                  onChange={(e) => setField("mediaCost", e.target.value)}
                  data-testid="input-media-cost"
                />
              </div>

              <div className="space-y-2">
                <Label>Koszt uszkodzeń</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.damageCost}
                  onChange={(e) => setField("damageCost", e.target.value)}
                  data-testid="input-damage-cost"
                />
              </div>

              <div className="space-y-2">
                <Label>Inne koszty</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.otherCosts}
                  onChange={(e) => setField("otherCosts", e.target.value)}
                  data-testid="input-other-costs"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SZKIC">Szkic</SelectItem>
                    <SelectItem value="ZATWIERDZONY">Zatwierdzony</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Opis uszkodzeń</Label>
              <Textarea
                value={form.damageDescription}
                onChange={(e) => setField("damageDescription", e.target.value)}
                data-testid="input-damage-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                data-testid="input-notes"
              />
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-muted-foreground">Saldo końcowe (auto):</span>
                  <span
                    className={`text-lg font-bold ${finalBalance < 0 ? "text-red-600" : ""}`}
                    data-testid="text-final-balance"
                  >
                    {fmt(finalBalance)} zł
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel">
                Anuluj
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending ? "Zapisywanie..." : editingId ? "Zapisz zmiany" : "Utwórz"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-detail-title">Szczegóły rozliczenia</DialogTitle>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-3">
              <DetailRow
                label="Najemca"
                value={
                  subleasesMap.get(detailDialog.subleaseId)
                    ? subleaseName(subleasesMap.get(detailDialog.subleaseId)!)
                    : `#${detailDialog.subleaseId}`
                }
              />
              <DetailRow label="Data rozliczenia" value={detailDialog.settlementDate} />
              <DetailRow label="Kwota kaucji" value={`${fmt(detailDialog.depositAmount)} zł`} />
              <DetailRow label="Kaucja zwrócona" value={`${fmt(detailDialog.depositReturned)} zł`} />
              <DetailRow label="Potrącenia z kaucji" value={`${fmt(detailDialog.depositDeductions)} zł`} />
              <DetailRow label="Zaległy czynsz" value={`${fmt(detailDialog.outstandingRent)} zł`} />
              <DetailRow label="Koszt mediów" value={`${fmt(detailDialog.mediaCost)} zł`} />
              <DetailRow label="Koszt uszkodzeń" value={`${fmt(detailDialog.damageCost)} zł`} />
              <DetailRow label="Inne koszty" value={`${fmt(detailDialog.otherCosts)} zł`} />
              <DetailRow
                label="Saldo końcowe"
                value={`${fmt(detailDialog.finalBalance)} zł`}
                bold
              />
              <DetailRow label="Status" value={detailDialog.status === "ZATWIERDZONY" ? "Zatwierdzony" : "Szkic"} />
              {detailDialog.damageDescription && (
                <DetailRow label="Opis uszkodzeń" value={detailDialog.damageDescription} />
              )}
              {detailDialog.notes && <DetailRow label="Notatki" value={detailDialog.notes} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4 flex-wrap">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : ""}`} data-testid={`text-detail-${label.toLowerCase().replace(/\s/g, "-")}`}>
        {value}
      </span>
    </div>
  );
}

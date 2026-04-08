import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ExtraRevenue } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const CATEGORIES = [
  "Sprzedaż pojazdu",
  "Sprzedaż nieruchomości",
  "Zwrot podatku",
  "Dywidenda",
  "Odszkodowanie",
  "Inne",
];

function formatPLN(v: number): string {
  return v.toLocaleString("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pl-PL", { year: "numeric", month: "long" });
}

type FormData = {
  description: string;
  amount: string;
  date: string;
  status: string;
  category: string;
};

const emptyForm: FormData = {
  description: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  status: "planowany",
  category: "",
};

export default function ExtraRevenues() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: entries, isLoading } = useQuery<ExtraRevenue[]>({
    queryKey: ["/api/extra-revenues"],
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", "/api/extra-revenues", {
        description: data.description,
        amount: data.amount,
        date: data.date,
        status: data.status,
        category: data.category || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extra-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance-forecast"] });
      setDialogOpen(false);
      toast({ title: "Dodano przychód dodatkowy" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      apiRequest("PATCH", `/api/extra-revenues/${id}`, {
        description: data.description,
        amount: data.amount,
        date: data.date,
        status: data.status,
        category: data.category || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extra-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance-forecast"] });
      setDialogOpen(false);
      setEditingId(null);
      toast({ title: "Zaktualizowano przychód dodatkowy" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/extra-revenues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extra-revenues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance-forecast"] });
      setDeleteConfirm(null);
      toast({ title: "Usunięto przychód dodatkowy" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(entry: ExtraRevenue) {
    setForm({
      description: entry.description,
      amount: String(entry.amount),
      date: entry.date,
      status: entry.status,
      category: entry.category || "",
    });
    setEditingId(entry.id);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.description || !form.amount || !form.date) {
      toast({ title: "Wypełnij wymagane pola", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const totalPlanned = entries?.filter(e => e.status === "planowany").reduce((s, e) => s + Number(e.amount), 0) || 0;
  const totalRealized = entries?.filter(e => e.status === "zrealizowany").reduce((s, e) => s + Number(e.amount), 0) || 0;

  return (
    <div className="space-y-4 pt-4" data-testid="page-extra-revenues">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Planowane: </span>
            <span className="font-semibold" data-testid="text-total-planned">{formatPLN(totalPlanned)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Zrealizowane: </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-total-realized">{formatPLN(totalRealized)}</span>
          </div>
        </div>
        <Button onClick={openAdd} size="sm" data-testid="button-add-extra-revenue">
          <Plus className="h-4 w-4 mr-1" />
          Dodaj przychód
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {entries && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Brak przychodów dodatkowych. Kliknij „Dodaj przychód" aby dodać pierwszy wpis.
          </CardContent>
        </Card>
      )}

      {entries && entries.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-extra-revenues">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold">Opis</th>
                  <th className="text-right px-4 py-3 font-semibold">Kwota</th>
                  <th className="text-left px-4 py-3 font-semibold">Data</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Kategoria</th>
                  <th className="text-right px-4 py-3 font-semibold">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    data-testid={`row-extra-revenue-${entry.id}`}
                  >
                    <td className="px-4 py-3 font-medium" data-testid={`text-description-${entry.id}`}>{entry.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" data-testid={`text-amount-${entry.id}`}>
                      {formatPLN(Number(entry.amount))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" data-testid={`text-date-${entry.id}`}>{formatDate(entry.date)}</td>
                    <td className="px-4 py-3" data-testid={`text-status-${entry.id}`}>
                      <Badge variant={entry.status === "zrealizowany" ? "default" : "secondary"}>
                        {entry.status === "zrealizowany" ? "Zrealizowany" : "Planowany"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" data-testid={`text-category-${entry.id}`}>
                      {entry.category || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(entry)}
                          data-testid={`button-edit-${entry.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(entry.id)}
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-extra-revenue">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edytuj przychód dodatkowy" : "Nowy przychód dodatkowy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="er-description">Opis *</Label>
              <Input
                id="er-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="np. Sprzedaż samochodu"
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="er-amount">Kwota (PLN) *</Label>
              <Input
                id="er-amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="np. 150000"
                data-testid="input-amount"
              />
            </div>
            <div>
              <Label htmlFor="er-date">Data *</Label>
              <Input
                id="er-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                data-testid="input-date"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planowany">Planowany</SelectItem>
                  <SelectItem value="zrealizowany">Zrealizowany</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={form.category || "_none"} onValueChange={(v) => setForm({ ...form, category: v === "_none" ? "" : v })}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Brak</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save">
              {isPending ? "Zapisywanie..." : editingId ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunąć ten przychód dodatkowy? Tej operacji nie można cofnąć.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

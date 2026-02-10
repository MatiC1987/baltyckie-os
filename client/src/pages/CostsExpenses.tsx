import { useState, useMemo } from "react";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-expenses";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Filter, TrendingDown, BarChart3 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenseSchema, type InsertExpense, type Expense } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  "Sprzątanie", "Media", "Energia", "Internet", "Telewizja",
  "Remont", "Wyposażenie", "Ubezpieczenie", "Podatki",
  "Marketing", "Opłaty administracyjne", "Konserwacja", "Inne"
];

export default function CostsExpenses() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: apartments } = useApartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const deleteExpense = useDeleteExpense();

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterForecast, setFilterForecast] = useState<string>("ALL");

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => {
      if (filterStartDate && e.date < filterStartDate) return false;
      if (filterEndDate && e.date > filterEndDate) return false;
      if (filterCategory && filterCategory !== "ALL" && e.category !== filterCategory) return false;
      if (filterType !== "ALL" && e.type !== filterType) return false;
      if (filterForecast === "FORECAST" && !e.isForecast) return false;
      if (filterForecast === "ACTUAL" && e.isForecast) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filterStartDate, filterEndDate, filterCategory, filterType, filterForecast]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const forecast = filteredExpenses.filter(e => e.isForecast).reduce((sum, e) => sum + Number(e.amount), 0);
    const actual = total - forecast;
    return { total, forecast, actual, count: filteredExpenses.length };
  }, [filteredExpenses]);

  const getApartmentName = (id: number | null) => {
    if (!id || !apartments) return null;
    return apartments.find(a => a.id === id)?.name || null;
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Czy na pewno chcesz usunąć ten koszt?")) {
      deleteExpense.mutate(id);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingExpense(null);
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterCategory("");
    setFilterType("ALL");
    setFilterForecast("ALL");
  };

  const hasFilters = filterStartDate || filterEndDate || filterCategory || filterType !== "ALL" || filterForecast !== "ALL";

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-costs-title">Koszty</h2>
          <p className="text-muted-foreground">Zarządzaj kosztami operacyjnymi i prognozami.</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-costs-title">Koszty</h2>
          <p className="text-muted-foreground">Zarządzaj kosztami operacyjnymi i prognozami.</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-expense">
          <Plus className="mr-2 h-4 w-4" /> Dodaj koszt
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total-costs">{stats.total.toFixed(2)} zł</div>
            <div className="text-xs text-muted-foreground">Suma kosztów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-actual-costs">{stats.actual.toFixed(2)} zł</div>
            <div className="text-xs text-muted-foreground">Rzeczywiste</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-muted-foreground" data-testid="text-stat-forecast-costs">{stats.forecast.toFixed(2)} zł</div>
            <div className="text-xs text-muted-foreground">Prognoza</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-count">{stats.count}</div>
            <div className="text-xs text-muted-foreground">Pozycji</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtry</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                Wyczyść
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Od daty</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                data-testid="input-filter-start-date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Do daty</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                data-testid="input-filter-end-date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  <SelectItem value="FIXED">Stały</SelectItem>
                  <SelectItem value="VARIABLE">Zmienny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dane/Prognoza</Label>
              <Select value={filterForecast} onValueChange={setFilterForecast}>
                <SelectTrigger data-testid="select-filter-forecast">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  <SelectItem value="ACTUAL">Rzeczywiste</SelectItem>
                  <SelectItem value="FORECAST">Prognoza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-[100]">
            <tr className="border-b">
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Data</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kategoria</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Nazwa / Dostawca</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Opis</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Apartament</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Faktura</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">VAT</th>
              <th className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">Kwota</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">Typ</th>
              <th className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground">
                  Brak kosztów do wyświetlenia.
                </td>
              </tr>
            ) : (
              filteredExpenses.map(expense => {
                const aptName = getApartmentName(expense.apartmentId);
                return (
                  <tr key={expense.id} className="border-b last:border-b-0 hover-elevate" data-testid={`row-expense-${expense.id}`}>
                    <td className="py-2 px-3 whitespace-nowrap">{expense.date}</td>
                    <td className="py-2 px-3">
                      <Badge variant="secondary">{expense.category}</Badge>
                    </td>
                    <td className="py-2 px-3">
                      {expense.vendor || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">
                      {expense.description || "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {aptName || <span className="text-muted-foreground">Ogólny</span>}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {expense.invoiceIssued ? (
                        <span className="text-xs">{expense.invoiceNumber || "TAK"}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-xs">
                      {expense.vatAmount && Number(expense.vatAmount) > 0 ? `${expense.vatAmount} zł` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-destructive">
                      {Number(expense.amount).toFixed(2)} zł
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary" className={expense.type === 'FIXED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}>
                          {expense.type === 'FIXED' ? 'Stały' : 'Zmienny'}
                        </Badge>
                        {expense.isForecast && (
                          <Badge variant="outline" className="text-xs">
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Prognoza
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(expense)}
                          data-testid={`button-edit-expense-${expense.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(expense.id)}
                          disabled={deleteExpense.isPending}
                          data-testid={`button-delete-expense-${expense.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setEditingExpense(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edytuj koszt" : "Nowy koszt"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editingExpense}
            onSuccess={() => {
              setIsDialogOpen(false);
              setEditingExpense(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ expense, onSuccess }: { expense: Expense | null; onSuccess: () => void }) {
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: apartments } = useApartments();
  const isEditing = !!expense;

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      date: expense?.date || new Date().toISOString().split('T')[0],
      category: expense?.category || "",
      amount: expense?.amount || "0",
      description: expense?.description || "",
      type: expense?.type || "VARIABLE",
      vatAmount: expense?.vatAmount || "0",
      apartmentId: expense?.apartmentId || null,
      isForecast: expense?.isForecast || false,
      vendor: expense?.vendor || "",
      invoiceIssued: expense?.invoiceIssued || false,
      invoiceNumber: expense?.invoiceNumber || "",
    }
  });

  const invoiceIssued = form.watch("invoiceIssued");

  const onSubmit = (data: InsertExpense) => {
    if (isEditing) {
      updateExpense.mutate({ id: expense.id, data }, { onSuccess: () => onSuccess() });
    } else {
      createExpense.mutate(data, { onSuccess: () => onSuccess() });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" {...form.register("date")} data-testid="input-expense-date" />
        </div>
        <div className="space-y-2">
          <Label>Kategoria</Label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Nazwa / Dostawca</Label>
          <Input {...form.register("vendor")} placeholder="np. IKEA" data-testid="input-expense-vendor" />
        </div>
        <div className="space-y-2">
          <Label>Kwota (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("amount")} data-testid="input-expense-amount" />
        </div>
        <div className="space-y-2">
          <Label>Typ kosztu</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="select-expense-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Stały</SelectItem>
                  <SelectItem value="VARIABLE">Zmienny</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>VAT (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("vatAmount")} data-testid="input-expense-vat" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Apartament (opcjonalnie)</Label>
          <Controller
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))} value={field.value?.toString() || "none"}>
                <SelectTrigger data-testid="select-expense-apartment">
                  <SelectValue placeholder="Ogólny koszt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ogólny koszt</SelectItem>
                  {apartments?.map((apt) => (
                    <SelectItem key={apt.id} value={apt.id.toString()}>{apt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Opis</Label>
          <Textarea {...form.register("description")} placeholder="Dodatkowe informacje" data-testid="input-expense-description" className="resize-none" />
        </div>

        <div className="col-span-2 flex items-center gap-6 py-2 border-t pt-4">
          <Controller
            control={form.control}
            name="isForecast"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isForecast"
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-forecast"
                />
                <Label htmlFor="isForecast" className="cursor-pointer text-sm">Prognoza (planowany koszt)</Label>
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="invoiceIssued"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="invoiceIssued"
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-invoice"
                />
                <Label htmlFor="invoiceIssued" className="cursor-pointer text-sm">Faktura</Label>
              </div>
            )}
          />
        </div>

        {invoiceIssued && (
          <div className="space-y-2 col-span-2">
            <Label>Numer faktury</Label>
            <Input {...form.register("invoiceNumber")} placeholder="np. FV/2026/001" data-testid="input-invoice-number" />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={createExpense.isPending || updateExpense.isPending} data-testid="button-submit-expense">
          {(createExpense.isPending || updateExpense.isPending) ? "Zapisywanie..." : (isEditing ? "Zapisz zmiany" : "Dodaj koszt")}
        </Button>
      </DialogFooter>
    </form>
  );
}

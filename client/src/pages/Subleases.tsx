import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, SubleasePayment, SubleaseAttachment, Apartment } from "@shared/schema";
import { format, addDays, addWeeks, addMonths, addQuarters, isBefore, isEqual } from "date-fns";
import { pl } from "date-fns/locale";
import { useMemo } from "react";
import {
  Plus, Pencil, Trash2, Upload, FileText, X, Search, Check,
  Building2, User, Briefcase, CreditCard, Paperclip,
  ArrowUpDown, ArrowUp, ArrowDown, Shield, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const PAYMENT_CATEGORIES = [
  "Czynsz", "Media", "Energia", "Internet", "Woda", "Ogrzewanie", "Kaucja", "Inne"
];

const PAYMENT_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  do_oplacenia: { label: "Do opłacenia", variant: "destructive" },
  oplacona: { label: "Opłacona", variant: "default" },
  czesciowo: { label: "Częściowo", variant: "secondary" },
};

function SubleaseFormFields({ form, setForm, apartments }: {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  apartments: Apartment[];
}) {
  const isCompany = form.tenantType === "firma";

  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Typ najemcy</Label>
        <Select value={form.tenantType || "osoba_fizyczna"} onValueChange={(v) => setForm({ ...form, tenantType: v })}>
          <SelectTrigger data-testid="select-tenant-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="osoba_fizyczna">Osoba fizyczna</SelectItem>
            <SelectItem value="firma">Firma</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCompany ? (
        <>
          <div className="space-y-2">
            <Label>Nazwa firmy</Label>
            <Input value={form.companyName || ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} data-testid="input-company-name" />
          </div>
          <div className="space-y-2">
            <Label>NIP</Label>
            <Input value={form.nip || ""} onChange={(e) => setForm({ ...form, nip: e.target.value })} data-testid="input-nip" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Imię</Label>
              <Input value={form.firstName || ""} onChange={(e) => setForm({ ...form, firstName: e.target.value })} data-testid="input-first-name" />
            </div>
            <div className="space-y-2">
              <Label>Nazwisko</Label>
              <Input value={form.lastName || ""} onChange={(e) => setForm({ ...form, lastName: e.target.value })} data-testid="input-last-name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>PESEL / Paszport</Label>
            <Input value={form.peselOrPassport || ""} onChange={(e) => setForm({ ...form, peselOrPassport: e.target.value })} data-testid="input-pesel" />
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-1">
          <Label>Ulica</Label>
          <Input value={form.street || ""} onChange={(e) => setForm({ ...form, street: e.target.value })} data-testid="input-street" />
        </div>
        <div className="space-y-2">
          <Label>Kod pocztowy</Label>
          <Input value={form.postalCode || ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} data-testid="input-postal-code" />
        </div>
        <div className="space-y-2">
          <Label>Miasto</Label>
          <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="input-city" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Telefon</Label>
          <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" />
        </div>
      </div>

      {isCompany && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Email do faktur</Label>
            <Input value={form.invoiceEmail || ""} onChange={(e) => setForm({ ...form, invoiceEmail: e.target.value })} data-testid="input-invoice-email" />
          </div>
          <div className="space-y-2">
            <Label>Stawka VAT</Label>
            <Select value={form.vatRate || "23%"} onValueChange={(v) => setForm({ ...form, vatRate: v })}>
              <SelectTrigger data-testid="select-vat-rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="23%">23%</SelectItem>
                <SelectItem value="8%">8%</SelectItem>
                <SelectItem value="0%">0%</SelectItem>
                <SelectItem value="zw.">zw.</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Apartamenty</Label>
        <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1" data-testid="select-apartments-multi">
          {apartments.map((a) => {
            const selectedIds: number[] = form.apartmentIds || (form.apartmentId ? [form.apartmentId] : []);
            const checked = selectedIds.includes(a.id);
            return (
              <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover-elevate cursor-pointer text-sm" data-testid={`checkbox-apartment-${a.id}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const newIds = checked ? selectedIds.filter(id => id !== a.id) : [...selectedIds, a.id];
                    setForm({ ...form, apartmentIds: newIds, apartmentId: newIds[0] || null });
                  }}
                  className="rounded"
                />
                {a.name}
              </label>
            );
          })}
        </div>
        {((form.apartmentIds || []).length > 0 || form.apartmentId) && (
          <div className="flex flex-wrap gap-1">
            {(form.apartmentIds || (form.apartmentId ? [form.apartmentId] : [])).map((id: number) => {
              const apt = apartments.find(a => a.id === id);
              return apt ? <Badge key={id} variant="secondary" className="text-xs">{apt.name}</Badge> : null;
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data rozpoczęcia</Label>
          <Input type="date" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-start-date" />
        </div>
        <div className="space-y-2">
          <Label>Data zakończenia</Label>
          <Input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-end-date" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Kwota czynszu (PLN)</Label>
          <Input type="number" step="0.01" value={form.rentAmount || ""} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} data-testid="input-rent-amount" />
        </div>
        <div className="space-y-2">
          <Label>Opłaty dodatkowe (PLN)</Label>
          <Input type="number" step="0.01" value={form.additionalFees || ""} onChange={(e) => setForm({ ...form, additionalFees: e.target.value })} data-testid="input-additional-fees" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="media-by-meters" className="text-sm font-medium cursor-pointer">Rozliczenie mediów według liczników</Label>
        <Switch
          id="media-by-meters"
          checked={!!form.mediaByMeters}
          onCheckedChange={(checked) => setForm({ ...form, mediaByMeters: checked })}
          data-testid="switch-media-by-meters"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="has-deposit" className="text-sm font-medium cursor-pointer">Kaucja</Label>
        <Switch
          id="has-deposit"
          checked={!!form.hasDeposit}
          onCheckedChange={(checked) => setForm({ ...form, hasDeposit: checked, ...(!checked ? { depositAmount: "", depositReturnDate: "" } : {}) })}
          data-testid="switch-has-deposit"
        />
      </div>

      {form.hasDeposit && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Kwota kaucji (PLN)</Label>
            <Input type="number" step="0.01" value={form.depositAmount || ""} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} data-testid="input-deposit-amount" />
          </div>
          <div className="space-y-2">
            <Label>Termin zwrotu kaucji</Label>
            <Input type="date" value={form.depositReturnDate || ""} onChange={(e) => setForm({ ...form, depositReturnDate: e.target.value })} data-testid="input-deposit-return-date" />
          </div>
        </div>
      )}
    </div>
  );
}

const RECURRING_FREQUENCIES = [
  { value: "daily", label: "Dziennie" },
  { value: "weekly", label: "Tygodniowo" },
  { value: "monthly", label: "Miesięcznie" },
  { value: "quarterly", label: "Kwartalnie" },
];

function generateRecurringDates(startDate: string, endDate: string, frequency: string, dayOfPeriod: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (frequency === "daily") {
    let current = new Date(start);
    while (isBefore(current, end) || isEqual(current, end)) {
      dates.push(format(current, "yyyy-MM-dd"));
      current = addDays(current, 1);
    }
    return dates;
  }

  if (frequency === "weekly") {
    let current = new Date(start);
    const targetDay = Math.min(dayOfPeriod, 7);
    while (current.getDay() !== (targetDay % 7)) {
      current = addDays(current, 1);
    }
    while (isBefore(current, end) || isEqual(current, end)) {
      dates.push(format(current, "yyyy-MM-dd"));
      current = addWeeks(current, 1);
    }
    return dates;
  }

  if (frequency === "monthly") {
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (isBefore(current, end) || isEqual(current, end)) {
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const day = Math.min(dayOfPeriod, lastDay);
      const dueDate = new Date(current.getFullYear(), current.getMonth(), day);
      if ((isBefore(dueDate, end) || isEqual(dueDate, end)) && (isBefore(start, dueDate) || isEqual(start, dueDate))) {
        dates.push(format(dueDate, "yyyy-MM-dd"));
      }
      current = addMonths(current, 1);
    }
    return dates;
  }

  if (frequency === "quarterly") {
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (isBefore(current, end) || isEqual(current, end)) {
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const day = Math.min(dayOfPeriod, lastDay);
      const dueDate = new Date(current.getFullYear(), current.getMonth(), day);
      if ((isBefore(dueDate, end) || isEqual(dueDate, end)) && (isBefore(start, dueDate) || isEqual(start, dueDate))) {
        dates.push(format(dueDate, "yyyy-MM-dd"));
      }
      current = addQuarters(current, 1);
    }
    return dates;
  }

  return dates;
}

function RecurringPaymentForm({ subleaseId, apartments, startDate, endDate, onClose }: {
  subleaseId: number;
  apartments: Apartment[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Czynsz");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfPeriod, setDayOfPeriod] = useState("10");
  const [apartmentId, setApartmentId] = useState("");
  const [saving, setSaving] = useState(false);

  const previewDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    return generateRecurringDates(startDate, endDate, frequency, parseInt(dayOfPeriod) || 1);
  }, [startDate, endDate, frequency, dayOfPeriod]);

  const handleGenerate = async () => {
    if (!title.trim() || !amount || previewDates.length === 0) return;
    setSaving(true);
    try {
      for (const dueDate of previewDates) {
        await fetch(`/api/subleases/${subleaseId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            category,
            amount,
            dueDate,
            status: "do_oplacenia",
            apartmentId: apartmentId ? parseInt(apartmentId) : null,
          }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'payments'] });
      toast({ title: "Sukces", description: `Wygenerowano ${previewDates.length} opłat cyklicznych` });
      onClose();
    } catch {
      toast({ title: "Błąd", description: "Nie udało się wygenerować opłat", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = frequency === "weekly" ? "Dzień tygodnia (1=pon, 7=ndz)" :
                   frequency === "daily" ? "" : "Do dnia miesiąca/kwartału";

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Opłata cykliczna</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tytuł</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Czynsz miesięczny" data-testid="input-recurring-title" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kategoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-recurring-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Kwota (PLN)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-recurring-amount" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cykliczność</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-recurring-frequency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRING_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {frequency !== "daily" && (
            <div className="space-y-1">
              <Label className="text-xs">{dayLabel}</Label>
              <Input type="number" min="1" max={frequency === "weekly" ? "7" : "31"} value={dayOfPeriod} onChange={(e) => setDayOfPeriod(e.target.value)} data-testid="input-recurring-day" />
            </div>
          )}
        </div>
        {apartments.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Apartament</Label>
            <Select value={apartmentId} onValueChange={setApartmentId}>
              <SelectTrigger data-testid="select-recurring-apartment"><SelectValue placeholder="Wybierz apartament" /></SelectTrigger>
              <SelectContent>
                {apartments.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {previewDates.length > 0 && (
          <div className="rounded-md border border-border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1.5">
              Podgląd: <span className="font-semibold text-foreground">{previewDates.length}</span> opłat
              {startDate && endDate && <span> (okres: {startDate} — {endDate})</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {previewDates.map((d, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
              ))}
            </div>
          </div>
        )}
        {!startDate || !endDate ? (
          <div className="text-xs text-destructive">Uzupełnij daty rozpoczęcia i zakończenia umowy w zakładce Dane, aby wygenerować opłaty.</div>
        ) : null}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Anuluj</Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!title.trim() || !amount || previewDates.length === 0 || saving}
            data-testid="button-generate-recurring"
          >
            {saving ? "Generowanie..." : `Wygeneruj ${previewDates.length} opłat`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsTab({ subleaseId, apartments, startDate, endDate }: { subleaseId: number; apartments: Apartment[]; startDate?: string; endDate?: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [payForm, setPayForm] = useState<Record<string, any>>({ title: "", category: "Czynsz", amount: "", dueDate: "", status: "do_oplacenia", apartmentId: "" });
  const [editingPayment, setEditingPayment] = useState<Record<string, any> | null>(null);

  const { data: payments = [], isLoading } = useQuery<SubleasePayment[]>({
    queryKey: ['/api/subleases', subleaseId, 'payments'],
    queryFn: async () => {
      const r = await fetch(`/api/subleases/${subleaseId}/payments`, { credentials: 'include' });
      if (!r.ok) throw new Error('Fetch error');
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/subleases/${subleaseId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'payments'] });
      toast({ title: "Sukces", description: "Dodano opłatę" });
      setShowAdd(false);
      setPayForm({ title: "", category: "Czynsz", amount: "", dueDate: "", status: "do_oplacenia", apartmentId: "" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/sublease-payments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'payments'] });
      toast({ title: "Sukces", description: "Zaktualizowano opłatę" });
      setEditingPayment(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/sublease-payments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'payments'] });
      toast({ title: "Sukces", description: "Usunięto opłatę" });
    },
  });

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === 'oplacona').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">Suma: <span className="font-semibold text-foreground">{total.toFixed(2)} PLN</span></div>
          <div className="text-sm text-muted-foreground">Opłacone: <span className="font-semibold text-green-600">{totalPaid.toFixed(2)} PLN</span></div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowRecurring(true)} data-testid="button-add-recurring">
            <RefreshCw className="h-4 w-4 mr-1" /> Dodaj cyklicznie
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-payment">
            <Plus className="h-4 w-4 mr-1" /> Dodaj opłatę
          </Button>
        </div>
      </div>

      {showRecurring && (
        <RecurringPaymentForm
          subleaseId={subleaseId}
          apartments={apartments}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setShowRecurring(false)}
        />
      )}

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tytuł</Label>
                <Input value={payForm.title} onChange={(e) => setPayForm({ ...payForm, title: e.target.value })} data-testid="input-payment-title" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kategoria</Label>
                <Select value={payForm.category} onValueChange={(v) => setPayForm({ ...payForm, category: v })}>
                  <SelectTrigger data-testid="select-payment-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kwota (PLN)</Label>
                <Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} data-testid="input-payment-amount" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Termin płatności</Label>
                <Input type="date" value={payForm.dueDate} onChange={(e) => setPayForm({ ...payForm, dueDate: e.target.value })} data-testid="input-payment-due-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={payForm.status} onValueChange={(v) => setPayForm({ ...payForm, status: v })}>
                  <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {apartments.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Apartament</Label>
                <Select value={payForm.apartmentId?.toString() || ""} onValueChange={(v) => setPayForm({ ...payForm, apartmentId: v ? parseInt(v) : null })}>
                  <SelectTrigger data-testid="select-payment-apartment"><SelectValue placeholder="Wybierz apartament" /></SelectTrigger>
                  <SelectContent>
                    {apartments.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Anuluj</Button>
              <Button size="sm" onClick={() => createMut.mutate(payForm)} disabled={!payForm.title || !payForm.amount || !payForm.dueDate || createMut.isPending} data-testid="button-save-payment">
                Zapisz
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Ładowanie...</div>
      ) : payments.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Brak opłat</div>
      ) : (
        <div className="max-h-[40vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł</TableHead>
                <TableHead>Apartament</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Kwota</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const st = PAYMENT_STATUSES[p.status] || { label: p.status, variant: "outline" as const };
                const isEditing = editingPayment?.id === p.id;

                if (isEditing) {
                  return (
                    <TableRow key={p.id} className="bg-muted/30" data-testid={`row-payment-edit-${p.id}`}>
                      <TableCell>
                        <Input
                          value={editingPayment.title}
                          onChange={(e) => setEditingPayment({ ...editingPayment, title: e.target.value })}
                          className="h-7 text-xs"
                          data-testid={`edit-input-payment-title-${p.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={editingPayment.apartmentId?.toString() || ""} onValueChange={(v) => setEditingPayment({ ...editingPayment, apartmentId: v ? parseInt(v) : null })}>
                          <SelectTrigger className="h-7 text-xs" data-testid={`edit-select-payment-apartment-${p.id}`}><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {apartments.map((a) => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editingPayment.category} onValueChange={(v) => setEditingPayment({ ...editingPayment, category: v })}>
                          <SelectTrigger className="h-7 text-xs" data-testid={`edit-select-payment-category-${p.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingPayment.amount}
                          onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })}
                          className="h-7 text-xs w-24"
                          data-testid={`edit-input-payment-amount-${p.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={editingPayment.dueDate}
                          onChange={(e) => setEditingPayment({ ...editingPayment, dueDate: e.target.value })}
                          className="h-7 text-xs"
                          data-testid={`edit-input-payment-due-date-${p.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={editingPayment.status} onValueChange={(v) => setEditingPayment({ ...editingPayment, status: v })}>
                          <SelectTrigger className="h-7 w-32 text-xs" data-testid={`edit-select-payment-status-${p.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" onClick={() => {
                            const { id, ...data } = editingPayment;
                            updateMut.mutate({ id, data: { title: data.title, category: data.category, amount: data.amount, dueDate: data.dueDate, status: data.status, apartmentId: data.apartmentId || null } });
                          }} disabled={updateMut.isPending} data-testid={`button-save-edit-payment-${p.id}`}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingPayment(null)} data-testid={`button-cancel-edit-payment-${p.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.apartmentId ? (apartments.find(a => a.id === p.apartmentId)?.name || "—") : "—"}
                    </TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{Number(p.amount).toFixed(2)} PLN</TableCell>
                    <TableCell>{p.dueDate}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v) => updateMut.mutate({ id: p.id, data: { status: v } })}>
                        <SelectTrigger className="h-7 w-32" data-testid={`select-payment-status-${p.id}`}>
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" onClick={() => setEditingPayment({
                          id: p.id,
                          title: p.title,
                          category: p.category,
                          amount: p.amount,
                          dueDate: p.dueDate,
                          status: p.status,
                          apartmentId: p.apartmentId,
                        })} data-testid={`button-edit-payment-${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(p.id)} data-testid={`button-delete-payment-${p.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AttachmentsTab({ subleaseId }: { subleaseId: number }) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("UMOWA");
  const [isUploading, setIsUploading] = useState(false);

  const { data: attachments = [] } = useQuery<SubleaseAttachment[]>({
    queryKey: ['/api/subleases', subleaseId, 'attachments'],
    queryFn: async () => {
      const r = await fetch(`/api/subleases/${subleaseId}/attachments`, { credentials: 'include' });
      if (!r.ok) throw new Error('Fetch error');
      return r.json();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/sublease-attachments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sublease-attachments/all'] });
      toast({ title: "Sukces", description: "Załącznik usunięty" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    const fileType = file.type;
    const category = selectedCategory;

    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fileName, size: file.size, contentType: fileType || "application/octet-stream" }),
      });
      if (!urlRes.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": fileType || "application/octet-stream" },
      });
      if (!uploadRes.ok) throw new Error("Nie udało się przesłać pliku");

      const saveRes = await fetch(`/api/subleases/${subleaseId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName, objectPath, fileType, category }),
      });
      if (!saveRes.ok) throw new Error("Nie udało się zapisać załącznika");

      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sublease-attachments/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Załącznik dodany" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40" data-testid="select-sublease-att-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UMOWA">Umowa</SelectItem>
            <SelectItem value="ANEKS">Aneks</SelectItem>
            <SelectItem value="PROTOKOL">Protokół</SelectItem>
            <SelectItem value="FAKTURA">Faktura</SelectItem>
            <SelectItem value="INNY">Inny</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="sublease-file-attach" className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
            <Upload className="h-4 w-4" />
            {isUploading ? "Przesyłanie..." : "Dodaj plik"}
          </div>
          <input id="sublease-file-attach" type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} data-testid="input-sublease-file" />
        </Label>
      </div>

      <div className="space-y-2">
        {attachments.length > 0 ? (
          attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50" data-testid={`row-sublease-att-${att.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <a href={att.objectPath} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">
                    {att.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{att.category}</Badge>
                    {att.uploadedAt && <span>{format(new Date(att.uploadedAt), "dd.MM.yyyy", { locale: pl })}</span>}
                  </div>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(att.id)} disabled={deleteMut.isPending} data-testid={`button-delete-sublease-att-${att.id}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">Brak załączników</div>
        )}
      </div>
    </div>
  );
}

type DepositSortKey = "apartment" | "tenant" | "amount" | "returnDate";

function DepositsToReturn({ subleases, apartments }: { subleases: Sublease[]; apartments: Apartment[] }) {
  const [sortKey, setSortKey] = useState<DepositSortKey>("returnDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const deposits = useMemo(() => {
    return subleases.filter(s => s.hasDeposit && s.depositAmount && Number(s.depositAmount) > 0);
  }, [subleases]);

  const getApartmentNames = (s: Sublease) => {
    const ids = s.apartmentIds || (s.apartmentId ? [s.apartmentId] : []);
    if (ids.length === 0) return "—";
    return ids.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ");
  };

  const getTenantName = (s: Sublease) => {
    if (s.tenantType === "firma") return s.companyName || "—";
    return [s.firstName, s.lastName].filter(Boolean).join(" ") || "—";
  };

  const sorted = useMemo(() => {
    const arr = [...deposits];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "apartment": return dir * getApartmentNames(a).localeCompare(getApartmentNames(b), "pl");
        case "tenant": return dir * getTenantName(a).localeCompare(getTenantName(b), "pl");
        case "amount": return dir * ((Number(a.depositAmount) || 0) - (Number(b.depositAmount) || 0));
        case "returnDate": return dir * (a.depositReturnDate || "9999").localeCompare(b.depositReturnDate || "9999");
        default: return 0;
      }
    });
    return arr;
  }, [deposits, sortKey, sortDir, apartments]);

  const handleSort = (key: DepositSortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ column }: { column: DepositSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (deposits.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Kaucje do zwrotu
        </CardTitle>
        <Badge variant="outline">{deposits.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("apartment")} data-testid="th-deposit-apartment">
                <div className="flex items-center">Apartament<SortIcon column="apartment" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tenant")} data-testid="th-deposit-tenant">
                <div className="flex items-center">Najemca<SortIcon column="tenant" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("amount")} data-testid="th-deposit-amount">
                <div className="flex items-center">Kwota kaucji<SortIcon column="amount" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("returnDate")} data-testid="th-deposit-return-date">
                <div className="flex items-center">Termin zwrotu<SortIcon column="returnDate" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => {
              const isOverdue = s.depositReturnDate && s.depositReturnDate < today;
              const isSoon = s.depositReturnDate && !isOverdue && s.depositReturnDate <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
              return (
                <TableRow key={s.id} data-testid={`row-deposit-${s.id}`}>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.apartmentIds || (s.apartmentId ? [s.apartmentId] : [])).map(id => {
                        const apt = apartments.find(a => a.id === id);
                        return apt ? <Badge key={id} variant="outline" className="text-xs">{apt.name}</Badge> : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{getTenantName(s)}</TableCell>
                  <TableCell>{Number(s.depositAmount).toFixed(2)} PLN</TableCell>
                  <TableCell>
                    <span className={isOverdue ? "text-destructive font-medium" : isSoon ? "text-orange-500 font-medium" : ""}>
                      {s.depositReturnDate || "—"}
                    </span>
                    {isOverdue && <Badge variant="destructive" className="ml-2 text-xs">Po terminie</Badge>}
                    {isSoon && !isOverdue && <Badge variant="outline" className="ml-2 text-xs border-orange-400 text-orange-500">Wkrótce</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function Subleases() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("dane");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"tenant" | "type" | "apartment" | "startDate" | "endDate" | "rent" | "status">("tenant");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [form, setForm] = useState<Record<string, any>>({
    tenantType: "osoba_fizyczna",
    startDate: "",
    endDate: "",
  });

  const { data: subleases = [], isLoading } = useQuery<Sublease[]>({
    queryKey: ['/api/subleases'],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ['/api/apartments'],
  });

  const { data: allAttachments = [] } = useQuery<SubleaseAttachment[]>({
    queryKey: ['/api/sublease-attachments/all'],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/subleases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Dodano umowę podnajmu" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/subleases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Zaktualizowano umowę" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/subleases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Usunięto umowę podnajmu" });
    },
  });

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setActiveTab("dane");
    setForm({ tenantType: "osoba_fizyczna", startDate: "", endDate: "" });
  };

  const openAdd = () => {
    setForm({ tenantType: "osoba_fizyczna", startDate: "", endDate: "" });
    setEditId(null);
    setActiveTab("dane");
    setOpen(true);
  };

  const openEdit = (s: Sublease) => {
    setForm({
      tenantType: s.tenantType,
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      companyName: s.companyName || "",
      nip: s.nip || "",
      street: s.street || "",
      postalCode: s.postalCode || "",
      city: s.city || "",
      peselOrPassport: s.peselOrPassport || "",
      phone: s.phone || "",
      email: s.email || "",
      invoiceEmail: s.invoiceEmail || "",
      vatRate: s.vatRate || "23%",
      apartmentId: s.apartmentId,
      apartmentIds: s.apartmentIds || (s.apartmentId ? [s.apartmentId] : []),
      startDate: s.startDate,
      endDate: s.endDate,
      rentAmount: s.rentAmount || "",
      additionalFees: s.additionalFees || "",
      hasDeposit: s.hasDeposit || false,
      depositAmount: s.depositAmount || "",
      depositReturnDate: s.depositReturnDate || "",
    });
    setEditId(s.id);
    setActiveTab("dane");
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.startDate || !form.endDate) {
      toast({ title: "Błąd", description: "Daty są wymagane", variant: "destructive" });
      return;
    }
    if (editId) {
      updateMut.mutate({ id: editId, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const getTenantName = (s: Sublease) => {
    if (s.tenantType === "firma") return s.companyName || "—";
    return [s.firstName, s.lastName].filter(Boolean).join(" ") || "—";
  };

  const getApartmentNames = (s: Sublease) => {
    const ids = s.apartmentIds || (s.apartmentId ? [s.apartmentId] : []);
    if (ids.length === 0) return "—";
    return ids.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ");
  };

  const isActive = (s: Sublease) => {
    const now = new Date().toISOString().slice(0, 10);
    return s.startDate <= now && s.endDate >= now;
  };

  const getStatusOrder = (s: Sublease) => isActive(s) ? 0 : s.endDate < new Date().toISOString().slice(0, 10) ? 2 : 1;

  const filtered = subleases.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getTenantName(s).toLowerCase();
    const apt = getApartmentNames(s).toLowerCase();
    return name.includes(q) || apt.includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "tenant": return dir * getTenantName(a).localeCompare(getTenantName(b), "pl");
      case "type": return dir * (a.tenantType || "").localeCompare(b.tenantType || "");
      case "apartment": return dir * getApartmentNames(a).localeCompare(getApartmentNames(b), "pl");
      case "startDate": return dir * (a.startDate || "").localeCompare(b.startDate || "");
      case "endDate": return dir * (a.endDate || "").localeCompare(b.endDate || "");
      case "rent": return dir * ((parseFloat(a.rentAmount || "0") || 0) - (parseFloat(b.rentAmount || "0") || 0));
      case "status": return dir * (getStatusOrder(a) - getStatusOrder(b));
      default: return 0;
    }
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ column }: { column: typeof sortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Umowy Podnajmu</h1>
        <Button onClick={openAdd} data-testid="button-add-sublease">
          <Plus className="h-4 w-4 mr-1" /> Dodaj umowę
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj najemcy lub apartamentu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-subleases"
          />
        </div>
        <Badge variant="outline">{filtered.length} umów</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-2" />
            <p>Brak umów podnajmu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tenant")} data-testid="th-tenant">
                  <div className="flex items-center">Najemca<SortIcon column="tenant" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")} data-testid="th-type">
                  <div className="flex items-center">Typ<SortIcon column="type" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("apartment")} data-testid="th-apartment">
                  <div className="flex items-center">Apartament<SortIcon column="apartment" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("startDate")} data-testid="th-start-date">
                  <div className="flex items-center">Data rozpoczęcia<SortIcon column="startDate" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("endDate")} data-testid="th-end-date">
                  <div className="flex items-center">Data zakończenia<SortIcon column="endDate" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("rent")} data-testid="th-rent">
                  <div className="flex items-center">Czynsz<SortIcon column="rent" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")} data-testid="th-status">
                  <div className="flex items-center">Status<SortIcon column="status" /></div>
                </TableHead>
                <TableHead>Załączniki</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => openEdit(s)} data-testid={`row-sublease-${s.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.tenantType === "firma" ? <Briefcase className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                      {getTenantName(s)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {s.tenantType === "firma" ? "Firma" : "Osoba"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.apartmentIds || (s.apartmentId ? [s.apartmentId] : [])).map(id => {
                        const apt = apartments.find(a => a.id === id);
                        return apt ? <Badge key={id} variant="outline" className="text-xs">{apt.name}</Badge> : null;
                      })}
                      {!(s.apartmentIds?.length) && !s.apartmentId && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`cell-start-date-${s.id}`}>{s.startDate}</TableCell>
                  <TableCell className="text-sm" data-testid={`cell-end-date-${s.id}`}>{s.endDate}</TableCell>
                  <TableCell>{s.rentAmount ? `${Number(s.rentAmount).toFixed(2)} PLN` : "—"}</TableCell>
                  <TableCell>
                    {isActive(s) ? (
                      <Badge variant="default" className="text-xs">Aktywna</Badge>
                    ) : s.endDate < new Date().toISOString().slice(0, 10) ? (
                      <Badge variant="secondary" className="text-xs">Zakończona</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Przyszła</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const atts = allAttachments.filter(a => a.subleaseId === s.id);
                      if (atts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                      return (
                        <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {atts.map(att => (
                            <a
                              key={att.id}
                              href={att.objectPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={att.fileName}
                              data-testid={`link-attachment-${att.id}`}
                            >
                              <Badge variant="outline" className="text-xs gap-1 cursor-pointer">
                                <FileText className="h-3 w-3" />
                                {att.category === 'UMOWA' ? 'Umowa' : att.category === 'ANEKS' ? 'Aneks' : 'Inny'}
                              </Badge>
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-sublease-${s.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-sublease-${s.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Usunąć umowę?</AlertDialogTitle>
                            <AlertDialogDescription>Usunięcie umowy usunie również powiązane opłaty i załączniki.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMut.mutate(s.id)} data-testid="button-confirm-delete">Usuń</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DepositsToReturn subleases={subleases} apartments={apartments} />

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editId ? "Edytuj umowę podnajmu" : "Nowa umowa podnajmu"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="dane" className="gap-1" data-testid="tab-dane">
                <User className="h-4 w-4" /> Dane
              </TabsTrigger>
              {editId && (
                <>
                  <TabsTrigger value="oplaty" className="gap-1" data-testid="tab-oplaty">
                    <CreditCard className="h-4 w-4" /> Opłaty
                  </TabsTrigger>
                  <TabsTrigger value="zalaczniki" className="gap-1" data-testid="tab-zalaczniki">
                    <Paperclip className="h-4 w-4" /> Załączniki
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="dane" className="flex-1 overflow-y-auto mt-0">
              <SubleaseFormFields form={form} setForm={setForm} apartments={apartments} />
            </TabsContent>

            {editId && (
              <>
                <TabsContent value="oplaty" className="flex-1 overflow-y-auto mt-0">
                  <PaymentsTab subleaseId={editId} apartments={
                    (() => {
                      const ids: number[] = form.apartmentIds || (form.apartmentId ? [form.apartmentId] : []);
                      return apartments.filter(a => ids.includes(a.id));
                    })()
                  } startDate={form.startDate} endDate={form.endDate} />
                </TabsContent>
                <TabsContent value="zalaczniki" className="flex-1 overflow-y-auto mt-0">
                  <AttachmentsTab subleaseId={editId} />
                </TabsContent>
              </>
            )}
          </Tabs>

          {activeTab === "dane" && (
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Anuluj</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-sublease">
                {editId ? "Zapisz zmiany" : "Dodaj umowę"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

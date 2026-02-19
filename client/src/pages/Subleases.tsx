import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, SubleasePayment, SubleaseAttachment, Apartment, SubleaseApartmentChange, DocumentTemplate } from "@shared/schema";
import { format, addDays, addWeeks, addMonths, addQuarters, isBefore, isEqual } from "date-fns";
import { pl } from "date-fns/locale";
import { useMemo } from "react";
import {
  Plus, Pencil, Trash2, Upload, FileText, X, Search, Check,
  Building2, User, Briefcase, CreditCard, Paperclip,
  ArrowUpDown, ArrowUp, ArrowDown, Shield, RefreshCw, Download, FileSignature,
  FileUp, Loader2, CalendarDays, Image, Clock, CheckCircle2, Archive, FilePlus2, MessageSquare, AlertTriangle, Zap, Droplets
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-delete-payment-${p.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Usunac platnosc?</AlertDialogTitle>
                              <AlertDialogDescription>Tej operacji nie mozna cofnac.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anuluj</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(p.id)} data-testid="button-confirm-delete-payment">Usun</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                  <button type="button" onClick={() => downloadAttachmentFile(att.id, att.fileName)} className="text-sm font-medium hover:underline truncate block text-left">
                    {att.fileName}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{att.category}</Badge>
                    {att.uploadedAt && <span>{format(new Date(att.uploadedAt), "dd.MM.yyyy", { locale: pl })}</span>}
                  </div>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" disabled={deleteMut.isPending} data-testid={`button-delete-sublease-att-${att.id}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunac zalacznik?</AlertDialogTitle>
                    <AlertDialogDescription>Plik "{att.fileName}" zostanie trwale usuniety.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMut.mutate(att.id)} data-testid="button-confirm-delete-att">Usun</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

function ApartmentChangesSection({ subleaseId, apartments, currentApartmentIds }: {
  subleaseId: number;
  apartments: Apartment[];
  currentApartmentIds: number[];
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [changeForm, setChangeForm] = useState({ oldApartmentId: "", newApartmentId: "", changeDate: "" });

  const { data: changes = [] } = useQuery<SubleaseApartmentChange[]>({
    queryKey: ['/api/subleases', subleaseId, 'apartment-changes'],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/subleases/${subleaseId}/apartment-changes`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'apartment-changes'] });
      toast({ title: "Zapisano zmiane apartamentu" });
      setShowForm(false);
      setChangeForm({ oldApartmentId: "", newApartmentId: "", changeDate: "" });
    },
    onError: (err: any) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/sublease-apartment-changes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'apartment-changes'] });
      toast({ title: "Usunieto zmiane" });
    },
  });

  const getAptName = (id: number) => apartments.find(a => a.id === id)?.name || `#${id}`;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Zmiany apartamentow</Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          data-testid="button-add-apartment-change"
        >
          <Plus className="h-3 w-3 mr-1" /> Dodaj zmiane
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Stary apartament</Label>
              <Select
                value={changeForm.oldApartmentId}
                onValueChange={(val) => setChangeForm(prev => ({ ...prev, oldApartmentId: val }))}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-old-apartment">
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent>
                  {currentApartmentIds.map(id => {
                    const apt = apartments.find(a => a.id === id);
                    return apt ? <SelectItem key={id} value={id.toString()}>{apt.name}</SelectItem> : null;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nowy apartament</Label>
              <Select
                value={changeForm.newApartmentId}
                onValueChange={(val) => setChangeForm(prev => ({ ...prev, newApartmentId: val }))}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-new-apartment">
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent>
                  {apartments.map(apt => (
                    <SelectItem key={apt.id} value={apt.id.toString()}>{apt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data zmiany</Label>
              <Input
                type="date"
                value={changeForm.changeDate}
                onChange={(e) => setChangeForm(prev => ({ ...prev, changeDate: e.target.value }))}
                className="h-8 text-xs"
                data-testid="input-change-date"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setChangeForm({ oldApartmentId: "", newApartmentId: "", changeDate: "" }); }}>
              Anuluj
            </Button>
            <Button
              size="sm"
              disabled={!changeForm.oldApartmentId || !changeForm.newApartmentId || !changeForm.changeDate || createMut.isPending}
              onClick={() => createMut.mutate({
                oldApartmentId: Number(changeForm.oldApartmentId),
                newApartmentId: Number(changeForm.newApartmentId),
                changeDate: changeForm.changeDate,
              })}
              data-testid="button-save-apartment-change"
            >
              Zapisz
            </Button>
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="space-y-1">
          {changes.map(ch => (
            <div key={ch.id} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2" data-testid={`row-apt-change-${ch.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{ch.changeDate}</Badge>
                <span className="text-muted-foreground">{getAptName(ch.oldApartmentId)}</span>
                <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                <span className="font-medium">{getAptName(ch.newApartmentId)}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`button-delete-apt-change-${ch.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Usunac zmiane apartamentu?</AlertDialogTitle>
                    <AlertDialogDescription>Tej operacji nie mozna cofnac.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMut.mutate(ch.id)} data-testid="button-confirm-delete-apt-change">Usun</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Subleases() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("dane");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"tenant" | "type" | "apartment" | "startDate" | "endDate" | "rent">("tenant");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [form, setForm] = useState<Record<string, any>>({
    tenantType: "osoba_fizyczna",
    startDate: "",
    endDate: "",
  });
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [pdfImportStep, setPdfImportStep] = useState<"upload" | "loading" | "review">("upload");
  const [pdfExtracted, setPdfExtracted] = useState<Record<string, any> | null>(null);
  const [pdfImportFiles, setPdfImportFiles] = useState<File[]>([]);
  const [pdfImportForm, setPdfImportForm] = useState<Record<string, any>>({});
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState<Record<string, any>>({ tenantType: "osoba_fizyczna", startDate: "", endDate: "" });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const { data: subleases = [], isLoading } = useQuery<Sublease[]>({
    queryKey: ['/api/subleases'],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ['/api/apartments'],
  });

  const { data: allAttachments = [] } = useQuery<SubleaseAttachment[]>({
    queryKey: ['/api/sublease-attachments/all'],
  });

  const { data: docTemplates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ['/api/document-templates'],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/subleases', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Dodano umowe podnajmu" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
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

  const [pdfPaymentSchedule, setPdfPaymentSchedule] = useState<Array<{ date: string; amount: string; description: string; apartmentId: number | null }>>([]);

  const handlePdfUpload = async (fileList: FileList) => {
    setPdfImportStep("loading");
    setPdfImportFiles(Array.from(fileList));
    try {
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append("files", fileList[i]);
      }
      const res = await fetch("/api/parse-sublease-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Blad parsowania");
      }
      const { extracted } = await res.json();
      setPdfExtracted(extracted);

      const matchedApartment = apartments.find((a) => {
        const addr = (extracted.apartmentAddress || "").toLowerCase();
        return addr.includes(a.name?.toLowerCase() || "___") ||
               addr.includes(a.address?.toLowerCase() || "___");
      });

      const mainEmail = extracted.email || "";
      setPdfImportForm({
        tenantType: extracted.tenantType || "osoba_fizyczna",
        firstName: extracted.firstName || "",
        lastName: extracted.lastName || "",
        companyName: extracted.companyName || "",
        nip: extracted.nip || "",
        peselOrPassport: extracted.peselOrPassport || "",
        street: extracted.street || "",
        postalCode: extracted.postalCode || "",
        city: extracted.city || "",
        phone: extracted.phone || "",
        email: mainEmail,
        invoiceEmail: extracted.invoiceEmail || mainEmail,
        vatRate: extracted.vatRate || "23%",
        apartmentId: matchedApartment?.id || null,
        apartmentIds: matchedApartment ? [matchedApartment.id] : [],
        startDate: extracted.startDate || "",
        endDate: extracted.endDate || "",
        rentAmount: extracted.rentAmount?.toString() || "",
        additionalFees: extracted.additionalFees?.toString() || "",
        mediaByMeters: extracted.mediaByMeters || false,
        hasDeposit: extracted.hasDeposit || false,
        depositAmount: extracted.depositAmount?.toString() || "",
        _apartmentAddress: extracted.apartmentAddress || "",
      });

      const schedule = (extracted.paymentSchedule || []).map((p: any) => ({
        date: p.date || "",
        amount: p.amount?.toString() || "",
        description: p.description || "",
        apartmentId: null as number | null,
      }));
      setPdfPaymentSchedule(schedule);

      setPdfImportStep("review");
    } catch (err: any) {
      toast({ title: "Blad importu", description: err.message, variant: "destructive" });
      setPdfImportStep("upload");
    }
  };

  const handlePdfImportSave = async () => {
    const { _apartmentAddress, ...rest } = pdfImportForm;
    const data = { ...rest };
    if (data.additionalFees === "" || data.additionalFees === null || data.additionalFees === undefined) data.additionalFees = "0";
    if (data.depositAmount === "" || data.depositAmount === null || data.depositAmount === undefined) data.depositAmount = null;
    if (data.rentAmount === "" || data.rentAmount === null || data.rentAmount === undefined) data.rentAmount = "0";
    if (data.invoiceEmail === undefined) data.invoiceEmail = "";
    createMut.mutate(data, {
      onSuccess: async (result: any) => {
        const subleaseId = result?.id;
        if (subleaseId && pdfPaymentSchedule.length > 0) {
          try {
            const paymentPromises = pdfPaymentSchedule
              .filter(p => p.date)
              .map(payment =>
                apiRequest('POST', `/api/subleases/${subleaseId}/payments`, {
                  title: payment.description || "Czynsz",
                  category: payment.description?.toLowerCase().includes("kaucja") ? "kaucja" : "czynsz",
                  amount: payment.amount || "0",
                  dueDate: payment.date,
                  status: "do_oplacenia",
                  ...(payment.apartmentId ? { apartmentId: payment.apartmentId } : {}),
                })
              );
            await Promise.all(paymentPromises);
            queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'payments'] });
          } catch (err: any) {
            toast({ title: "Uwaga", description: "Umowa zapisana, ale nie udalo sie dodac czesci harmonogramu", variant: "destructive" });
          }
        }
        if (subleaseId && pdfImportFiles.length > 0) {
          try {
            for (const file of pdfImportFiles) {
              const fileName = file.name;
              const fileType = file.type || "application/octet-stream";
              const urlRes = await fetch("/api/uploads/request-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: fileName, size: file.size, contentType: fileType }),
              });
              if (!urlRes.ok) continue;
              const { uploadURL, objectPath } = await urlRes.json();
              const uploadRes = await fetch(uploadURL, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": fileType },
              });
              if (!uploadRes.ok) continue;
              await fetch(`/api/subleases/${subleaseId}/attachments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fileName, objectPath, fileType, category: "UMOWA" }),
              });
            }
            queryClient.invalidateQueries({ queryKey: ['/api/subleases', subleaseId, 'attachments'] });
            queryClient.invalidateQueries({ queryKey: ['/api/sublease-attachments/all'] });
          } catch (err: any) {
            toast({ title: "Uwaga", description: "Umowa zapisana, ale nie udalo sie dodac zalacznikow", variant: "destructive" });
          }
        }
        setPdfImportOpen(false);
        setPdfImportStep("upload");
        setPdfExtracted(null);
        setPdfPaymentSchedule([]);
        setPdfImportFiles([]);
      },
    });
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
      mediaByMeters: s.mediaByMeters || false,
      hasDeposit: s.hasDeposit || false,
      depositAmount: s.depositAmount || "",
      depositReturnDate: s.depositReturnDate || "",
      status: s.status || "AKTYWNA",
      comment: s.comment || "",
    });
    setEditId(s.id);
    setActiveTab("dane");
    setOpen(true);
  };

  const updateCommentMut = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => apiRequest('PUT', `/api/subleases/${id}`, { comment }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/subleases'] }); },
  });

  const [meterReminderOpen, setMeterReminderOpen] = useState(false);
  const [meterReminderStep, setMeterReminderStep] = useState<"ask" | "form">("ask");
  const [pendingConfirmId, setPendingConfirmId] = useState<number | null>(null);
  const [initialMeters, setInitialMeters] = useState({
    energia_odczyt: "",
    energia_stawka: "",
    woda_ciepla_odczyt: "",
    woda_ciepla_stawka: "",
    woda_zimna_odczyt: "",
    woda_zimna_stawka: "",
  });
  const [savingMeters, setSavingMeters] = useState(false);

  const confirmSigningMut = useMutation({
    mutationFn: async (id: number) => apiRequest('PUT', `/api/subleases/${id}`, { status: "AKTYWNA" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      toast({ title: "Sukces", description: "Umowa potwierdzona jako aktywna" });
      setPendingConfirmId(null);
    },
  });

  const handleConfirmSigning = (s: Sublease) => {
    if (s.mediaByMeters) {
      setPendingConfirmId(s.id);
      setMeterReminderStep("ask");
      setInitialMeters({ energia_odczyt: "", energia_stawka: "", woda_ciepla_odczyt: "", woda_ciepla_stawka: "", woda_zimna_odczyt: "", woda_zimna_stawka: "" });
      setMeterReminderOpen(true);
    } else {
      confirmSigningMut.mutate(s.id);
    }
  };

  const downloadAttachmentFile = async (attId: number, fileName: string) => {
    try {
      const resp = await fetch(`/api/sublease-attachments/${attId}/download`);
      if (!resp.ok) throw new Error("Blad pobierania pliku");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Blad", description: err.message || "Nie udalo sie pobrac pliku", variant: "destructive" });
    }
  };

  const saveMeterReadingsAndConfirm = async () => {
    if (!pendingConfirmId) return;
    setSavingMeters(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const types = [
        { type: "energia", reading: initialMeters.energia_odczyt, price: initialMeters.energia_stawka },
        { type: "woda_ciepla", reading: initialMeters.woda_ciepla_odczyt, price: initialMeters.woda_ciepla_stawka },
        { type: "woda_zimna", reading: initialMeters.woda_zimna_odczyt, price: initialMeters.woda_zimna_stawka },
      ];
      for (const { type, reading, price } of types) {
        if (reading) {
          await apiRequest('POST', `/api/subleases/${pendingConfirmId}/meter-settings`, {
            meterType: type,
            initialReading: reading,
            initialDate: todayStr,
            unitPrice: price || null,
          });
        }
        if (price) {
          await apiRequest('POST', `/api/subleases/${pendingConfirmId}/meter-prices`, {
            meterType: type,
            unitPrice: price,
            validFrom: todayStr,
          });
        }
      }
      confirmSigningMut.mutate(pendingConfirmId);
      setMeterReminderOpen(false);
      toast({ title: "Sukces", description: "Zapisano stany poczatkowe licznikow" });
    } catch (err: any) {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    } finally {
      setSavingMeters(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!selectedTemplateId) {
      toast({ title: "Błąd", description: "Wybierz szablon dokumentu", variant: "destructive" });
      return;
    }
    if (!generateForm.startDate || !generateForm.endDate) {
      toast({ title: "Błąd", description: "Daty są wymagane", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/subleases/generate-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templateId: parseInt(selectedTemplateId), data: generateForm }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Błąd generowania");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = res.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      link.href = url;
      link.download = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : "umowa.docx";
      link.click();
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ['/api/subleases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sublease-attachments/all'] });
      toast({ title: "Sukces", description: "Wygenerowano umowę i dodano do podpisywania" });
      setGenerateOpen(false);
      setGenerateForm({ tenantType: "osoba_fizyczna", startDate: "", endDate: "" });
      setSelectedTemplateId("");
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
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

  const getEffectiveStatus = (s: Sublease) => {
    if (s.status === "W_TRAKCIE_PODPISYWANIA") return "W_TRAKCIE_PODPISYWANIA";
    const now = new Date().toISOString().slice(0, 10);
    if (s.endDate < now) return "ZAKONCZONA";
    return "AKTYWNA";
  };

  const isActive = (s: Sublease) => getEffectiveStatus(s) === "AKTYWNA";

  const filtered = subleases.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getTenantName(s).toLowerCase();
    const apt = getApartmentNames(s).toLowerCase();
    return name.includes(q) || apt.includes(q);
  });

  const signingList = filtered.filter(s => getEffectiveStatus(s) === "W_TRAKCIE_PODPISYWANIA");
  const activeList = filtered.filter(s => getEffectiveStatus(s) === "AKTYWNA");
  const archiveList = filtered.filter(s => getEffectiveStatus(s) === "ZAKONCZONA");

  const sortList = (list: Sublease[]) => [...list].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "tenant": return dir * getTenantName(a).localeCompare(getTenantName(b), "pl");
      case "type": return dir * (a.tenantType || "").localeCompare(b.tenantType || "");
      case "apartment": return dir * getApartmentNames(a).localeCompare(getApartmentNames(b), "pl");
      case "startDate": return dir * (a.startDate || "").localeCompare(b.startDate || "");
      case "endDate": return dir * (a.endDate || "").localeCompare(b.endDate || "");
      case "rent": return dir * ((parseFloat(a.rentAmount || "0") || 0) - (parseFloat(b.rentAmount || "0") || 0));
      default: return 0;
    }
  });

  const getDaysSincePrepared = (s: Sublease) => {
    if (!s.preparedAt) return null;
    const prepared = new Date(s.preparedAt);
    const now = new Date();
    return Math.floor((now.getTime() - prepared.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ column }: { column: typeof sortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleExportCSV = () => {
    const header = "Najemca;Typ;Apartamenty;Od;Do;Czynsz;Status";
    const allFiltered = [...signingList, ...activeList, ...archiveList];
    const rows = allFiltered.map(s => {
      const status = getEffectiveStatus(s) === "W_TRAKCIE_PODPISYWANIA" ? "W trakcie podpisywania" : getEffectiveStatus(s) === "AKTYWNA" ? "Aktywna" : "Zakończona";
      return `${getTenantName(s)};${s.tenantType === "firma" ? "Firma" : "Osoba fizyczna"};${getApartmentNames(s)};${s.startDate || ""};${s.endDate || ""};${parseFloat(s.rentAmount || "0").toFixed(2).replace(".", ",")};${status}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `podnajmy-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [editingComment, setEditingComment] = useState<{ id: number; value: string } | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Umowy podnajem" description="Zarządzanie umowami podnajmu." icon={FileSignature} actions={
        <>
          <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1" /> Eksport CSV
          </Button>
          <Button variant="outline" onClick={() => { setPdfImportOpen(true); setPdfImportStep("upload"); }} data-testid="button-import-pdf">
            <FileUp className="h-4 w-4 mr-1" /> Import z PDF
          </Button>
          <Button variant="outline" onClick={() => setGenerateOpen(true)} data-testid="button-generate-contract">
            <FilePlus2 className="h-4 w-4 mr-1" /> Generuj umowę
          </Button>
          <Button onClick={openAdd} data-testid="button-add-sublease">
            <Plus className="h-4 w-4 mr-1" /> Dodaj umowę
          </Button>
        </>
      } />

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
      ) : (
        <div className="space-y-6">
          {signingList.length > 0 && (
            <Card className="border-amber-500/50 dark:border-amber-400/40" data-testid="module-signing">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-base">W trakcie podpisywania</CardTitle>
                  <Badge variant="outline" className="text-xs">{signingList.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Najemca</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Apartament</TableHead>
                        <TableHead>Od</TableHead>
                        <TableHead>Do</TableHead>
                        <TableHead>Czynsz</TableHead>
                        <TableHead>Przygotowano</TableHead>
                        <TableHead>Dokument</TableHead>
                        <TableHead>Komentarz</TableHead>
                        <TableHead className="w-[140px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortList(signingList).map((s) => {
                        const daysSince = getDaysSincePrepared(s);
                        return (
                          <TableRow key={s.id} className="cursor-pointer" onClick={() => openEdit(s)} data-testid={`row-sublease-${s.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {s.tenantType === "firma" ? <Briefcase className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                                {getTenantName(s)}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{s.tenantType === "firma" ? "Firma" : "Osoba"}</Badge></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(s.apartmentIds || (s.apartmentId ? [s.apartmentId] : [])).map(id => {
                                  const apt = apartments.find(a => a.id === id);
                                  return apt ? <Badge key={id} variant="outline" className="text-xs">{apt.name}</Badge> : null;
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{s.startDate}</TableCell>
                            <TableCell className="text-sm">{s.endDate}</TableCell>
                            <TableCell>{s.rentAmount ? `${Number(s.rentAmount).toFixed(2)} PLN` : "—"}</TableCell>
                            <TableCell>
                              {s.preparedAt ? (
                                <div className="flex flex-col">
                                  <span className="text-xs">{format(new Date(s.preparedAt), "dd.MM.yyyy", { locale: pl })}</span>
                                  <span className={`text-xs font-medium ${daysSince !== null && daysSince > 7 ? "text-destructive" : daysSince !== null && daysSince > 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                                    {daysSince !== null ? `${daysSince} dni temu` : ""}
                                  </span>
                                </div>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const atts = allAttachments.filter(a => a.subleaseId === s.id);
                                if (atts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                                return (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {atts.map(att => (
                                      <button key={att.id} type="button" onClick={() => downloadAttachmentFile(att.id, att.fileName)} title={att.fileName} data-testid={`link-attachment-${att.id}`} className="inline-flex">
                                        <Badge variant="outline" className="text-xs gap-1 cursor-pointer">
                                          <FileText className="h-3 w-3" />
                                          {att.category === 'UMOWA' ? 'Umowa' : att.category === 'ANEKS' ? 'Aneks' : 'Inny'}
                                        </Badge>
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {editingComment?.id === s.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editingComment.value}
                                    onChange={(e) => setEditingComment({ ...editingComment, value: e.target.value })}
                                    className="h-7 text-xs min-w-[120px]"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateCommentMut.mutate({ id: s.id, comment: editingComment.value });
                                        setEditingComment(null);
                                      }
                                      if (e.key === "Escape") setEditingComment(null);
                                    }}
                                    autoFocus
                                    data-testid={`input-comment-${s.id}`}
                                  />
                                  <Button size="icon" variant="ghost" onClick={() => { updateCommentMut.mutate({ id: s.id, comment: editingComment.value }); setEditingComment(null); }}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className="text-xs text-muted-foreground cursor-text min-w-[80px] min-h-[24px] flex items-center"
                                  onClick={() => setEditingComment({ id: s.id, value: s.comment || "" })}
                                  data-testid={`text-comment-${s.id}`}
                                >
                                  {s.comment || <span className="italic text-muted-foreground/50">Kliknij aby dodać...</span>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="default" onClick={() => handleConfirmSigning(s)} data-testid={`button-confirm-signing-${s.id}`}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Potwierdź
                                </Button>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="module-active">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Aktywne umowy</CardTitle>
                <Badge variant="outline" className="text-xs">{activeList.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activeList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-sm">Brak aktywnych umów</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tenant")}>
                          <div className="flex items-center">Najemca<SortIcon column="tenant" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")}>
                          <div className="flex items-center">Typ<SortIcon column="type" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("apartment")}>
                          <div className="flex items-center">Apartament<SortIcon column="apartment" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("startDate")}>
                          <div className="flex items-center">Od<SortIcon column="startDate" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("endDate")}>
                          <div className="flex items-center">Do<SortIcon column="endDate" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort("rent")}>
                          <div className="flex items-center">Czynsz<SortIcon column="rent" /></div>
                        </TableHead>
                        <TableHead>Załączniki</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortList(activeList).map((s) => (
                        <TableRow key={s.id} className="cursor-pointer" onClick={() => openEdit(s)} data-testid={`row-sublease-${s.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {s.tenantType === "firma" ? <Briefcase className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                              {getTenantName(s)}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{s.tenantType === "firma" ? "Firma" : "Osoba"}</Badge></TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(s.apartmentIds || (s.apartmentId ? [s.apartmentId] : [])).map(id => {
                                const apt = apartments.find(a => a.id === id);
                                return apt ? <Badge key={id} variant="outline" className="text-xs">{apt.name}</Badge> : null;
                              })}
                              {!(s.apartmentIds?.length) && !s.apartmentId && "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{s.startDate}</TableCell>
                          <TableCell className="text-sm">{s.endDate}</TableCell>
                          <TableCell>{s.rentAmount ? `${Number(s.rentAmount).toFixed(2)} PLN` : "—"}</TableCell>
                          <TableCell>
                            {(() => {
                              const atts = allAttachments.filter(a => a.subleaseId === s.id);
                              if (atts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                              return (
                                <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                  {atts.map(att => (
                                    <button key={att.id} type="button" onClick={() => downloadAttachmentFile(att.id, att.fileName)} title={att.fileName} data-testid={`link-attachment-${att.id}`} className="inline-flex">
                                      <Badge variant="outline" className="text-xs gap-1 cursor-pointer">
                                        <FileText className="h-3 w-3" />
                                        {att.category === 'UMOWA' ? 'Umowa' : att.category === 'ANEKS' ? 'Aneks' : 'Inny'}
                                      </Badge>
                                    </button>
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
            </CardContent>
          </Card>

          {archiveList.length > 0 && (
            <Card data-testid="module-archive">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Archiwum</CardTitle>
                  <Badge variant="outline" className="text-xs">{archiveList.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Najemca</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Apartament</TableHead>
                        <TableHead>Od</TableHead>
                        <TableHead>Do</TableHead>
                        <TableHead>Czynsz</TableHead>
                        <TableHead>Załączniki</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortList(archiveList).map((s) => (
                        <TableRow key={s.id} className="cursor-pointer opacity-70" onClick={() => openEdit(s)} data-testid={`row-sublease-${s.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {s.tenantType === "firma" ? <Briefcase className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                              {getTenantName(s)}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{s.tenantType === "firma" ? "Firma" : "Osoba"}</Badge></TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(s.apartmentIds || (s.apartmentId ? [s.apartmentId] : [])).map(id => {
                                const apt = apartments.find(a => a.id === id);
                                return apt ? <Badge key={id} variant="outline" className="text-xs">{apt.name}</Badge> : null;
                              })}
                              {!(s.apartmentIds?.length) && !s.apartmentId && "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{s.startDate}</TableCell>
                          <TableCell className="text-sm">{s.endDate}</TableCell>
                          <TableCell>{s.rentAmount ? `${Number(s.rentAmount).toFixed(2)} PLN` : "—"}</TableCell>
                          <TableCell>
                            {(() => {
                              const atts = allAttachments.filter(a => a.subleaseId === s.id);
                              if (atts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                              return (
                                <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                  {atts.map(att => (
                                    <button key={att.id} type="button" onClick={() => downloadAttachmentFile(att.id, att.fileName)} title={att.fileName} data-testid={`link-attachment-${att.id}`} className="inline-flex">
                                      <Badge variant="outline" className="text-xs gap-1 cursor-pointer">
                                        <FileText className="h-3 w-3" />
                                        {att.category === 'UMOWA' ? 'Umowa' : att.category === 'ANEKS' ? 'Aneks' : 'Inny'}
                                      </Badge>
                                    </button>
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
              </CardContent>
            </Card>
          )}
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
              {editId && (
                <ApartmentChangesSection
                  subleaseId={editId}
                  apartments={apartments}
                  currentApartmentIds={form.apartmentIds || (form.apartmentId ? [form.apartmentId] : [])}
                />
              )}
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

      <Dialog open={pdfImportOpen} onOpenChange={(v) => { if (!v) { setPdfImportOpen(false); setPdfImportStep("upload"); setPdfExtracted(null); setPdfPaymentSchedule([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import umowy z pliku</DialogTitle>
          </DialogHeader>

          {pdfImportStep === "upload" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="border-2 border-dashed rounded-md p-8 w-full flex flex-col items-center gap-3 text-muted-foreground">
                <FileUp className="h-10 w-10" />
                <p className="text-sm">Wybierz pliki z umowa podnajmu</p>
                <p className="text-xs">PDF lub zdjecia (JPG, PNG) - mozesz wybrac kilka plikow naraz</p>
                <p className="text-xs">Np. 6 zdjec stron umowy z aparatu lub 1 plik PDF</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                  multiple
                  className="hidden"
                  id="pdf-upload-input"
                  data-testid="input-pdf-upload"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) handlePdfUpload(files);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => document.getElementById("pdf-upload-input")?.click()} data-testid="button-select-pdf">
                  <Upload className="h-4 w-4 mr-1" /> Wybierz pliki
                </Button>
              </div>
            </div>
          )}

          {pdfImportStep === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Analizuje dokument...</p>
              <p className="text-xs text-muted-foreground">Trwa rozpoznawanie tekstu i ekstrakcja danych z pliku</p>
            </div>
          )}

          {pdfImportStep === "review" && (
            <>
              <p className="text-sm text-muted-foreground mb-2">Sprawdź i popraw wyciągnięte dane przed zapisem:</p>
              {pdfImportForm._apartmentAddress && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md mb-2">
                  Adres z PDF: <span className="font-medium">{pdfImportForm._apartmentAddress}</span>
                </div>
              )}
              <SubleaseFormFields form={pdfImportForm} setForm={setPdfImportForm} apartments={apartments} />

              {pdfPaymentSchedule.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Harmonogram oplat ({pdfPaymentSchedule.length})</Label>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(pdfImportForm.apartmentIds || []).length > 1 && !pdfPaymentSchedule.some(r => r.apartmentId) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const aptIds: number[] = pdfImportForm.apartmentIds || [];
                            if (aptIds.length <= 1) return;
                            const newRows: typeof pdfPaymentSchedule = [];
                            for (const row of pdfPaymentSchedule) {
                              const originalAmount = parseFloat(row.amount) || 0;
                              const splitAmount = originalAmount > 0 ? Math.round((originalAmount / aptIds.length) * 100) / 100 : 0;
                              for (const aptId of aptIds) {
                                newRows.push({
                                  date: row.date,
                                  amount: splitAmount > 0 ? String(splitAmount) : "",
                                  description: row.description + " - " + (apartments.find(a => a.id === aptId)?.name || `Apt ${aptId}`),
                                  apartmentId: aptId,
                                });
                              }
                            }
                            setPdfPaymentSchedule(newRows);
                          }}
                          data-testid="button-split-per-apartment"
                        >
                          <Building2 className="h-3 w-3 mr-1" /> Rozdziel na apartamenty
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfPaymentSchedule(prev => [...prev, { date: "", amount: "", description: "", apartmentId: null }])}
                        data-testid="button-add-schedule-row"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Dodaj
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[120px_100px_130px_1fr_36px] gap-1 p-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                      <span>Data</span>
                      <span>Kwota</span>
                      <span>Apartament</span>
                      <span>Opis</span>
                      <span></span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {pdfPaymentSchedule.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[120px_100px_130px_1fr_36px] gap-1 p-1 border-t items-center" data-testid={`row-schedule-${idx}`}>
                          <Input
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const updated = [...pdfPaymentSchedule];
                              updated[idx] = { ...updated[idx], date: e.target.value };
                              setPdfPaymentSchedule(updated);
                            }}
                            className="h-8 text-xs"
                            data-testid={`input-schedule-date-${idx}`}
                          />
                          <Input
                            type="number"
                            value={row.amount}
                            onChange={(e) => {
                              const updated = [...pdfPaymentSchedule];
                              updated[idx] = { ...updated[idx], amount: e.target.value };
                              setPdfPaymentSchedule(updated);
                            }}
                            className="h-8 text-xs"
                            placeholder="0.00"
                            data-testid={`input-schedule-amount-${idx}`}
                          />
                          <Select
                            value={row.apartmentId?.toString() || "none"}
                            onValueChange={(val) => {
                              const updated = [...pdfPaymentSchedule];
                              updated[idx] = { ...updated[idx], apartmentId: val === "none" ? null : Number(val) };
                              setPdfPaymentSchedule(updated);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-schedule-apt-${idx}`}>
                              <SelectValue placeholder="Wszystkie" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Wszystkie</SelectItem>
                              {(pdfImportForm.apartmentIds || []).map((aptId: number) => {
                                const apt = apartments.find(a => a.id === aptId);
                                return apt ? <SelectItem key={aptId} value={aptId.toString()}>{apt.name}</SelectItem> : null;
                              })}
                            </SelectContent>
                          </Select>
                          <Input
                            value={row.description}
                            onChange={(e) => {
                              const updated = [...pdfPaymentSchedule];
                              updated[idx] = { ...updated[idx], description: e.target.value };
                              setPdfPaymentSchedule(updated);
                            }}
                            className="h-8 text-xs"
                            data-testid={`input-schedule-desc-${idx}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPdfPaymentSchedule(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-schedule-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setPdfImportOpen(false); setPdfImportStep("upload"); setPdfExtracted(null); setPdfPaymentSchedule([]); }}>
                  Anuluj
                </Button>
                <Button onClick={handlePdfImportSave} disabled={createMut.isPending || !pdfImportForm.startDate || !pdfImportForm.endDate} data-testid="button-save-pdf-import">
                  {createMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Zapisz umowe
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generuj umowę z szablonu</DialogTitle>
            <DialogDescription>Wypełnij dane najemcy, wybierz szablon i wygeneruj dokument Word.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Szablon dokumentu</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Wybierz szablon..." />
                </SelectTrigger>
                <SelectContent>
                  {docTemplates.filter((t: any) => t.category === "PODNAJEM").map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                  {docTemplates.filter((t: any) => t.category !== "PODNAJEM").map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SubleaseFormFields form={generateForm} setForm={setGenerateForm} apartments={apartments} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Anuluj</Button>
            <Button onClick={handleGenerateContract} disabled={generating} data-testid="button-do-generate">
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FilePlus2 className="h-4 w-4 mr-1" />}
              Generuj i zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={meterReminderOpen} onOpenChange={(open) => { if (!open) { setMeterReminderOpen(false); setPendingConfirmId(null); } }}>
        <DialogContent className="max-w-lg">
          {meterReminderStep === "ask" ? (
            <>
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="rounded-full bg-amber-500/20 p-4">
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                </div>
                <DialogTitle className="text-xl">Spisz liczniki!</DialogTitle>
                <DialogDescription className="text-base leading-relaxed">
                  Ta umowa ma zaznaczone rozliczanie mediow wedlug zuzycia licznikowego.
                  <span className="block mt-2 font-semibold text-foreground">
                    Czy chcesz teraz wprowadzic stany poczatkowe licznikow i stawki jednostkowe?
                  </span>
                  <span className="block mt-1 text-sm text-muted-foreground">
                    Mozesz rowniez wprowadzic je pozniej w szczegolach umowy.
                  </span>
                </DialogDescription>
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => { setMeterReminderOpen(false); setPendingConfirmId(null); }} data-testid="button-cancel-meter-reminder">
                  Anuluj
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (pendingConfirmId) confirmSigningMut.mutate(pendingConfirmId);
                    setMeterReminderOpen(false);
                  }}
                  data-testid="button-skip-meters"
                >
                  Wprowadze pozniej
                </Button>
                <Button
                  variant="default"
                  onClick={() => setMeterReminderStep("form")}
                  data-testid="button-enter-meters"
                >
                  Wprowadz teraz
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Stany poczatkowe licznikow</DialogTitle>
                <DialogDescription>
                  Wprowadz odczyty licznikow oraz stawki jednostkowe na dzien dzisiejszy ({format(new Date(), "dd.MM.yyyy", { locale: pl })}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Energia elektryczna
                  </div>
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Stan licznika (kWh)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="np. 12345.678"
                        value={initialMeters.energia_odczyt}
                        onChange={(e) => setInitialMeters({ ...initialMeters, energia_odczyt: e.target.value })}
                        data-testid="input-meter-energia-reading"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stawka (PLN/kWh)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="np. 0.85"
                        value={initialMeters.energia_stawka}
                        onChange={(e) => setInitialMeters({ ...initialMeters, energia_stawka: e.target.value })}
                        data-testid="input-meter-energia-price"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Droplets className="h-4 w-4 text-red-400" />
                    Woda ciepla
                  </div>
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Stan licznika (m3)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="np. 123.456"
                        value={initialMeters.woda_ciepla_odczyt}
                        onChange={(e) => setInitialMeters({ ...initialMeters, woda_ciepla_odczyt: e.target.value })}
                        data-testid="input-meter-woda-ciepla-reading"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stawka (PLN/m3)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="np. 25.00"
                        value={initialMeters.woda_ciepla_stawka}
                        onChange={(e) => setInitialMeters({ ...initialMeters, woda_ciepla_stawka: e.target.value })}
                        data-testid="input-meter-woda-ciepla-price"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Droplets className="h-4 w-4 text-blue-400" />
                    Woda zimna
                  </div>
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Stan licznika (m3)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="np. 234.567"
                        value={initialMeters.woda_zimna_odczyt}
                        onChange={(e) => setInitialMeters({ ...initialMeters, woda_zimna_odczyt: e.target.value })}
                        data-testid="input-meter-woda-zimna-reading"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stawka (PLN/m3)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="np. 12.00"
                        value={initialMeters.woda_zimna_stawka}
                        onChange={(e) => setInitialMeters({ ...initialMeters, woda_zimna_stawka: e.target.value })}
                        data-testid="input-meter-woda-zimna-price"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setMeterReminderStep("ask")} data-testid="button-back-meter-form">
                  Wstecz
                </Button>
                <Button
                  variant="default"
                  onClick={saveMeterReadingsAndConfirm}
                  disabled={savingMeters}
                  data-testid="button-save-meters-confirm"
                >
                  {savingMeters ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Zapisz i potwierdz podpisanie
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

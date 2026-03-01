import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/DataTable";
import { Plus, FileDown, Trash2, Loader2, FileSpreadsheet, Pencil, Copy, ChevronDown, ChevronUp, X, Search, FileWarning } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Customer, CompanySettings } from "@shared/schema";
import jsPDF from "jspdf";
import "jspdf-autotable";

function removeDiacritics(text: string): string {
  const map: Record<string, string> = {
    "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] || ch);
}

function formatPLN(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num as number)) return "0,00 PLN";
  return (num as number).toFixed(2).replace(".", ",") + " PLN";
}

type InvoiceItem = { name: string; pkwiu: string; quantity: number; unitPrice: number; vatRate: string };

const DOC_TYPES: Record<string, string> = {
  FAKTURA_VAT: "VAT", FAKTURA_PROFORMA: "Proforma", RACHUNEK: "Rachunek", FAKTURA_KORYGUJACA: "Korekta",
};
const VAT_RATES = ["23%", "8%", "5%", "0%", "zw."];
const PAYMENT_STATUSES: Record<string, string> = { NIEOPLACONA: "Nieopłacona", CZESCIOWO: "Częściowo", OPLACONA: "Opłacona" };
const PAYMENT_METHODS: Record<string, string> = { PRZELEW: "Przelew", GOTOWKA: "Gotówka", KARTA: "Karta" };
const STATUS_LABELS: Record<string, string> = { WYSTAWIONA: "Wystawiona", OPLACONA: "Opłacona", ANULOWANA: "Anulowana" };

function paymentBadge(s: string) {
  if (s === "OPLACONA") return <Badge data-testid={`badge-payment-${s}`}>Opłacona</Badge>;
  if (s === "CZESCIOWO") return <Badge variant="secondary" data-testid={`badge-payment-${s}`}>Częściowo</Badge>;
  return <Badge variant="outline" data-testid={`badge-payment-${s}`}>Nieopłacona</Badge>;
}

function statusBadge(s: string) {
  if (s === "OPLACONA") return <Badge data-testid={`badge-status-${s}`}>Opłacona</Badge>;
  if (s === "ANULOWANA") return <Badge variant="destructive" data-testid={`badge-status-${s}`}>Anulowana</Badge>;
  return <Badge variant="secondary" data-testid={`badge-status-${s}`}>Wystawiona</Badge>;
}

function emptyItem(): InvoiceItem { return { name: "", pkwiu: "", quantity: 1, unitPrice: 0, vatRate: "23%" }; }

function genNumber(invoices: Invoice[]): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `FV/${y}/${m}/`;
  const existing = invoices.filter(i => i.invoiceNumber.startsWith(prefix)).map(i => {
    const n = parseInt(i.invoiceNumber.replace(prefix, ""), 10);
    return isNaN(n) ? 0 : n;
  });
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function calcVat(rate: string, net: number): number {
  if (rate === "zw." || rate === "0%") return 0;
  const pct = parseFloat(rate) / 100;
  return Math.round(net * pct * 100) / 100;
}

function defaultForm() {
  const today = new Date().toISOString().split("T")[0];
  const due = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  return {
    documentType: "FAKTURA_VAT", invoiceNumber: "", currency: "PLN",
    issueDate: today, saleDate: today, dueDate: due, issuePlace: "",
    sourceType: "", sourceId: "",
    paymentStatus: "NIEOPLACONA", paymentMethod: "PRZELEW", paidAmount: "0",
    buyerName: "", buyerNip: "", buyerAddress: "", buyerCity: "", buyerPostalCode: "", buyerCountry: "Polska", buyerEmail: "",
    sellerName: "", sellerNip: "", sellerAddress: "", sellerCity: "", sellerPostalCode: "", sellerCountry: "Polska",
    sellerBankAccount: "", sellerBankAccount2: "",
    notes: "", correctionOfId: null as number | null,
  };
}

export function Invoices() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [sec1, setSec1] = useState(true);
  const [sec2, setSec2] = useState(false);
  const [sec3, setSec3] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [gusLoading, setGusLoading] = useState(false);

  const lookupGus = async () => {
    const nip = form.buyerNip.replace(/[\s-]/g, '');
    if (!nip || nip.length < 10) {
      toast({ title: "Wpisz poprawny NIP (10 cyfr)", variant: "destructive" });
      return;
    }
    setGusLoading(true);
    try {
      const res = await fetch(`/api/gus/lookup-nip/${nip}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Nie znaleziono");
      }
      const data = await res.json();
      setForm(f => ({
        ...f,
        buyerName: data.name || f.buyerName,
        buyerNip: data.nip || f.buyerNip,
        buyerAddress: data.street || f.buyerAddress,
        buyerCity: data.city || f.buyerCity,
        buyerPostalCode: data.postalCode || f.buyerPostalCode,
      }));
      toast({ title: "Pobrano dane z GUS" });
    } catch (err: any) {
      toast({ title: "Błąd GUS", description: err.message, variant: "destructive" });
    } finally {
      setGusLoading(false);
    }
  };

  const { data: invoicesData = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: customersData = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });

  const filtered = useMemo(() => {
    let list = invoicesData;
    if (statusFilter !== "all") list = list.filter(i => i.status === statusFilter);
    if (paymentFilter !== "all") list = list.filter(i => i.paymentStatus === paymentFilter);
    return list;
  }, [invoicesData, statusFilter, paymentFilter]);

  const { netAmount, vatAmount, grossAmount } = useMemo(() => {
    let net = 0, vat = 0;
    items.forEach(it => { const n = it.quantity * it.unitPrice; net += n; vat += calcVat(it.vatRate, n); });
    return { netAmount: net, vatAmount: vat, grossAmount: net + vat };
  }, [items]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/invoices", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }); setDialogOpen(false); toast({ title: "Faktura utworzona" }); },
    onError: () => { toast({ title: "Błąd", description: "Nie udało się utworzyć faktury", variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PATCH", `/api/invoices/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }); setDialogOpen(false); toast({ title: "Faktura zaktualizowana" }); },
    onError: () => { toast({ title: "Błąd", description: "Nie udało się zaktualizować faktury", variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/invoices/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }); toast({ title: "Faktura usunięta" }); },
    onError: () => { toast({ title: "Błąd", description: "Nie udało się usunąć faktury", variant: "destructive" }); },
  });

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm({ ...defaultForm(), invoiceNumber: genNumber(invoicesData) });
    setItems([emptyItem()]);
    setSec1(true); setSec2(false); setSec3(false);
    setDialogOpen(true);
  }, [invoicesData]);

  const openEdit = useCallback((inv: Invoice) => {
    setEditingId(inv.id);
    let parsed: InvoiceItem[] = [emptyItem()];
    try { parsed = JSON.parse(inv.items); } catch {}
    setItems(parsed.length > 0 ? parsed : [emptyItem()]);
    setForm({
      documentType: inv.documentType || "FAKTURA_VAT", invoiceNumber: inv.invoiceNumber, currency: inv.currency || "PLN",
      issueDate: inv.issueDate, saleDate: inv.saleDate || inv.issueDate, dueDate: inv.dueDate, issuePlace: inv.issuePlace || "",
      sourceType: inv.sourceType || "", sourceId: inv.sourceId ? String(inv.sourceId) : "",
      paymentStatus: inv.paymentStatus || "NIEOPLACONA", paymentMethod: inv.paymentMethod || "PRZELEW",
      paidAmount: inv.paidAmount ? String(inv.paidAmount) : "0",
      buyerName: inv.buyerName, buyerNip: inv.buyerNip || "", buyerAddress: inv.buyerAddress || "",
      buyerCity: inv.buyerCity || "", buyerPostalCode: inv.buyerPostalCode || "", buyerCountry: inv.buyerCountry || "Polska", buyerEmail: inv.buyerEmail || "",
      sellerName: inv.sellerName, sellerNip: inv.sellerNip || "", sellerAddress: inv.sellerAddress || "",
      sellerCity: inv.sellerCity || "", sellerPostalCode: inv.sellerPostalCode || "", sellerCountry: inv.sellerCountry || "Polska",
      sellerBankAccount: inv.sellerBankAccount || "", sellerBankAccount2: inv.sellerBankAccount2 || "",
      notes: inv.notes || "", correctionOfId: inv.correctionOfId || null,
    });
    setSec1(true); setSec2(false); setSec3(false);
    setDialogOpen(true);
  }, []);

  const duplicate = useCallback((inv: Invoice) => {
    openEdit(inv);
    setEditingId(null);
    setForm(f => ({ ...f, invoiceNumber: genNumber(invoicesData), correctionOfId: null }));
  }, [invoicesData, openEdit]);

  const correct = useCallback((inv: Invoice) => {
    openEdit(inv);
    setEditingId(null);
    setForm(f => ({ ...f, documentType: "FAKTURA_KORYGUJACA", invoiceNumber: genNumber(invoicesData), correctionOfId: inv.id }));
  }, [invoicesData, openEdit]);

  const loadCompanySettings = async () => {
    try {
      const res = await apiRequest("GET", "/api/company-settings");
      const cs: CompanySettings = await res.json();
      setForm(f => ({
        ...f,
        sellerName: cs.companyName || f.sellerName, sellerNip: cs.nip || f.sellerNip,
        sellerAddress: cs.street || f.sellerAddress, sellerCity: cs.city || f.sellerCity,
        sellerPostalCode: cs.postalCode || f.sellerPostalCode,
        sellerBankAccount: cs.bankAccount || f.sellerBankAccount,
      }));
      toast({ title: "Dane firmowe wczytane" });
    } catch { toast({ title: "Błąd", description: "Nie udało się wczytać danych firmowych", variant: "destructive" }); }
  };

  const loadCustomer = (c: Customer) => {
    const name = c.companyName || `${c.firstName} ${c.lastName}`;
    setForm(f => ({
      ...f, buyerName: name, buyerNip: c.nip || "", buyerAddress: c.street || "",
      buyerCity: c.city || "", buyerPostalCode: c.postalCode || "", buyerCountry: c.country || "Polska", buyerEmail: c.email || "",
    }));
    setShowCustomerSelect(false);
  };

  const handleSubmit = () => {
    const itemsJson = JSON.stringify(items);
    const payload: any = {
      ...form, items: itemsJson, netAmount: netAmount.toFixed(2), vatAmount: vatAmount.toFixed(2), grossAmount: grossAmount.toFixed(2),
      sourceId: form.sourceId ? Number(form.sourceId) : null, status: "WYSTAWIONA",
      sellerNip: form.sellerNip || null, sellerAddress: form.sellerAddress || null, sellerCity: form.sellerCity || null,
      sellerPostalCode: form.sellerPostalCode || null, sellerCountry: form.sellerCountry || null,
      sellerBankAccount: form.sellerBankAccount || null, sellerBankAccount2: form.sellerBankAccount2 || null,
      buyerNip: form.buyerNip || null, buyerAddress: form.buyerAddress || null, buyerCity: form.buyerCity || null,
      buyerPostalCode: form.buyerPostalCode || null, buyerCountry: form.buyerCountry || null, buyerEmail: form.buyerEmail || null,
      issuePlace: form.issuePlace || null, saleDate: form.saleDate || null, sourceType: form.sourceType || null,
      paidAmount: form.paidAmount || "0", paymentMethod: form.paymentMethod || null, notes: form.notes || null,
      correctionOfId: form.correctionOfId || null,
    };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, val: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const generatePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    const rd = removeDiacritics;
    doc.setFontSize(18);
    doc.text(rd(`Faktura ${invoice.invoiceNumber}`), 14, 22);
    doc.setFontSize(10);
    doc.text(rd(`Data wystawienia: ${invoice.issueDate}`), 14, 32);
    doc.text(rd(`Termin platnosci: ${invoice.dueDate}`), 14, 38);
    doc.setFontSize(12);
    doc.text(rd("Sprzedawca:"), 14, 50);
    doc.setFontSize(10);
    doc.text(rd(invoice.sellerName), 14, 56);
    if (invoice.sellerNip) doc.text(rd(`NIP: ${invoice.sellerNip}`), 14, 62);
    if (invoice.sellerAddress) doc.text(rd(invoice.sellerAddress), 14, 68);
    doc.setFontSize(12);
    doc.text(rd("Nabywca:"), 110, 50);
    doc.setFontSize(10);
    doc.text(rd(invoice.buyerName), 110, 56);
    if (invoice.buyerNip) doc.text(rd(`NIP: ${invoice.buyerNip}`), 110, 62);
    if (invoice.buyerAddress) doc.text(rd(invoice.buyerAddress), 110, 68);
    let lineItems: any[] = [];
    try { lineItems = JSON.parse(invoice.items); } catch {}
    const tableData = lineItems.map((item: any, i: number) => {
      const net = (item.quantity || 1) * (item.unitPrice || 0);
      const vatAmt = calcVat(item.vatRate || "23%", net);
      return [i + 1, rd(item.name || ""), item.pkwiu || "", item.quantity || 1, formatPLN(item.unitPrice), formatPLN(net), item.vatRate || "23%", formatPLN(vatAmt), formatPLN(net + vatAmt)];
    });
    (doc as any).autoTable({
      startY: 78,
      head: [[rd("Lp."), rd("Nazwa"), "PKWiU", rd("Ilosc"), rd("Cena jed."), rd("Netto"), rd("VAT%"), rd("VAT"), rd("Brutto")]],
      body: tableData, theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: [41, 128, 185] },
    });
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(11);
    doc.text(rd(`Netto: ${formatPLN(invoice.netAmount)}`), 130, finalY + 10);
    doc.text(rd(`VAT: ${formatPLN(invoice.vatAmount)}`), 130, finalY + 16);
    doc.setFontSize(12);
    doc.text(rd(`Brutto: ${formatPLN(invoice.grossAmount)}`), 130, finalY + 24);
    if (invoice.notes) { doc.setFontSize(9); doc.text(rd(`Uwagi: ${invoice.notes}`), 14, finalY + 36); }
    doc.save(`faktura_${invoice.invoiceNumber.replace(/\//g, "_")}.pdf`);
    toast({ title: "PDF wygenerowany" });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const SectionHeader = ({ title, open, toggle }: { title: string; open: boolean; toggle: () => void }) => (
    <button onClick={toggle} className="flex items-center justify-between w-full py-2 text-left font-semibold text-sm" data-testid={`toggle-section-${title.toLowerCase().replace(/\s/g, "-")}`}>
      {title} {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  const F = (field: keyof typeof form) => ({
    value: form[field] as string,
    onChange: (e: any) => setForm(f => ({ ...f, [field]: e.target.value })),
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-invoices">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-payment-filter"><SelectValue placeholder="Płatność" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew} data-testid="button-create-invoice"><Plus className="h-4 w-4 mr-2" />Dodaj fakturę</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edytuj fakturę" : "Nowa faktura"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <SectionHeader title="Faktura" open={sec1} toggle={() => setSec1(!sec1)} />
            {sec1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Typ dokumentu</Label>
                    <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v }))}>
                      <SelectTrigger data-testid="select-document-type"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Nr faktury</Label>
                    <Input {...F("invoiceNumber")} data-testid="input-invoice-number" />
                  </div>
                  <div className="space-y-1">
                    <Label>Waluta</Label>
                    <Input {...F("currency")} data-testid="input-currency" />
                  </div>
                  <div className="space-y-1"><Label>Data wystawienia</Label><Input type="date" {...F("issueDate")} data-testid="input-issue-date" /></div>
                  <div className="space-y-1"><Label>Data sprzedaży</Label><Input type="date" {...F("saleDate")} data-testid="input-sale-date" /></div>
                  <div className="space-y-1"><Label>Miejsce wystawienia</Label><Input {...F("issuePlace")} data-testid="input-issue-place" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Źródło (typ)</Label><Input {...F("sourceType")} placeholder="np. rezerwacja" data-testid="input-source-type" /></div>
                  <div className="space-y-1"><Label>Źródło (ID)</Label><Input {...F("sourceId")} data-testid="input-source-id" /></div>
                </div>
                <div className="border-t pt-3">
                  <Label className="text-xs text-muted-foreground">Płatność</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                    <div className="space-y-1">
                      <Label>Status płatności</Label>
                      <Select value={form.paymentStatus} onValueChange={v => setForm(f => ({ ...f, paymentStatus: v }))}>
                        <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(PAYMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Metoda płatności</Label>
                      <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                        <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Termin płatności</Label><Input type="date" {...F("dueDate")} data-testid="input-due-date" /></div>
                    <div className="space-y-1"><Label>Zapłacono</Label><Input type="number" step="0.01" {...F("paidAmount")} data-testid="input-paid-amount" /></div>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Nabywca</Label>
                    <Button variant="outline" size="sm" onClick={() => setShowCustomerSelect(!showCustomerSelect)} data-testid="button-load-customer">Wczytaj z bazy klientów</Button>
                  </div>
                  {showCustomerSelect && customersData.length > 0 && (
                    <div className="border rounded-md p-2 mb-2 max-h-40 overflow-y-auto space-y-1" data-testid="customer-select-list">
                      {customersData.map(c => (
                        <button key={c.id} className="block w-full text-left text-sm hover-elevate rounded-md px-2 py-1" onClick={() => loadCustomer(c)} data-testid={`button-customer-${c.id}`}>
                          {c.companyName || `${c.firstName} ${c.lastName}`} {c.nip ? `(NIP: ${c.nip})` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1"><Label>Nazwa</Label><Input {...F("buyerName")} data-testid="input-buyer-name" /></div>
                    <div className="space-y-1"><Label>NIP</Label><div className="flex gap-1"><Input {...F("buyerNip")} className="flex-1" data-testid="input-buyer-nip" /><Button type="button" variant="outline" size="icon" onClick={lookupGus} disabled={gusLoading} title="Pobierz dane z GUS" data-testid="button-gus-lookup">{gusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div></div>
                    <div className="space-y-1"><Label>Email</Label><Input {...F("buyerEmail")} data-testid="input-buyer-email" /></div>
                    <div className="space-y-1"><Label>Adres</Label><Input {...F("buyerAddress")} data-testid="input-buyer-address" /></div>
                    <div className="space-y-1"><Label>Miasto</Label><Input {...F("buyerCity")} data-testid="input-buyer-city" /></div>
                    <div className="space-y-1"><Label>Kod pocztowy</Label><Input {...F("buyerPostalCode")} data-testid="input-buyer-postal-code" /></div>
                    <div className="space-y-1"><Label>Kraj</Label><Input {...F("buyerCountry")} data-testid="input-buyer-country" /></div>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Pozycje faktury</Label>
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end" data-testid={`item-row-${idx}`}>
                      <div className="col-span-3 space-y-1"><Label className="text-xs">Nazwa</Label><Input value={it.name} onChange={e => updateItem(idx, "name", e.target.value)} data-testid={`input-item-name-${idx}`} /></div>
                      <div className="col-span-2 space-y-1"><Label className="text-xs">PKWiU</Label><Input value={it.pkwiu} onChange={e => updateItem(idx, "pkwiu", e.target.value)} data-testid={`input-item-pkwiu-${idx}`} /></div>
                      <div className="col-span-2 space-y-1"><Label className="text-xs">Ilość</Label><Input type="number" value={it.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} data-testid={`input-item-qty-${idx}`} /></div>
                      <div className="col-span-2 space-y-1"><Label className="text-xs">Cena netto</Label><Input type="number" step="0.01" value={it.unitPrice} onChange={e => updateItem(idx, "unitPrice", Number(e.target.value))} data-testid={`input-item-price-${idx}`} /></div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">VAT</Label>
                        <Select value={it.vatRate} onValueChange={v => updateItem(idx, "vatRate", v)}>
                          <SelectTrigger data-testid={`select-item-vat-${idx}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {items.length > 1 && <Button size="icon" variant="ghost" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-remove-item-${idx}`}><X className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyItem()])} data-testid="button-add-item"><Plus className="h-4 w-4 mr-1" />Dodaj pozycję</Button>
                </div>
                <div className="border-t pt-3 flex flex-wrap gap-4 justify-end text-sm">
                  <span data-testid="text-net-total">Netto: <strong>{formatPLN(netAmount)}</strong></span>
                  <span data-testid="text-vat-total">VAT: <strong>{formatPLN(vatAmount)}</strong></span>
                  <span data-testid="text-gross-total">Brutto: <strong>{formatPLN(grossAmount)}</strong></span>
                </div>
              </div>
            )}

            <SectionHeader title="Sprzedawca" open={sec2} toggle={() => setSec2(!sec2)} />
            {sec2 && (
              <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={loadCompanySettings} data-testid="button-load-company">Wczytaj z danych firmowych</Button>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Nazwa</Label><Input {...F("sellerName")} data-testid="input-seller-name" /></div>
                  <div className="space-y-1"><Label>NIP</Label><Input {...F("sellerNip")} data-testid="input-seller-nip" /></div>
                  <div className="space-y-1"><Label>Adres</Label><Input {...F("sellerAddress")} data-testid="input-seller-address" /></div>
                  <div className="space-y-1"><Label>Miasto</Label><Input {...F("sellerCity")} data-testid="input-seller-city" /></div>
                  <div className="space-y-1"><Label>Kod pocztowy</Label><Input {...F("sellerPostalCode")} data-testid="input-seller-postal-code" /></div>
                  <div className="space-y-1"><Label>Kraj</Label><Input {...F("sellerCountry")} data-testid="input-seller-country" /></div>
                  <div className="space-y-1"><Label>Nr konta bankowego</Label><Input {...F("sellerBankAccount")} data-testid="input-seller-bank" /></div>
                  <div className="space-y-1"><Label>Nr konta bankowego 2</Label><Input {...F("sellerBankAccount2")} data-testid="input-seller-bank2" /></div>
                </div>
              </div>
            )}

            <SectionHeader title="Uwagi" open={sec3} toggle={() => setSec3(!sec3)} />
            {sec3 && <Textarea {...F("notes")} data-testid="input-notes" />}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Anuluj</Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.invoiceNumber || !form.buyerName} data-testid="button-submit-invoice">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Zapisz" : "Utwórz fakturę"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DataTable
        data={filtered}
        columns={[
          { header: "Numer", accessorKey: "invoiceNumber", cell: (inv) => <span data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</span> },
          { header: "Typ", cell: (inv) => <Badge variant="outline" data-testid={`badge-type-${inv.id}`}>{DOC_TYPES[inv.documentType || "FAKTURA_VAT"] || inv.documentType}</Badge>, sortable: false },
          { header: "Data wystawienia", accessorKey: "issueDate", cell: (inv) => <span data-testid={`text-issue-date-${inv.id}`}>{inv.issueDate}</span> },
          { header: "Nabywca", accessorKey: "buyerName", cell: (inv) => <span data-testid={`text-buyer-name-${inv.id}`}>{inv.buyerName}</span> },
          { header: "Netto", accessorKey: "netAmount", cell: (inv) => <span data-testid={`text-net-amount-${inv.id}`}>{formatPLN(inv.netAmount)}</span> },
          { header: "VAT", accessorKey: "vatAmount", cell: (inv) => <span data-testid={`text-vat-amount-${inv.id}`}>{formatPLN(inv.vatAmount)}</span> },
          { header: "Brutto", accessorKey: "grossAmount", cell: (inv) => <span data-testid={`text-gross-amount-${inv.id}`}>{formatPLN(inv.grossAmount)}</span> },
          { header: "Płatność", cell: (inv) => paymentBadge(inv.paymentStatus || "NIEOPLACONA"), sortable: false },
          { header: "Status", cell: (inv) => statusBadge(inv.status), sortable: false },
          { header: "Akcje", sortable: false, cell: (inv) => (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(inv); }} data-testid={`button-edit-${inv.id}`} title="Edytuj"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicate(inv); }} data-testid={`button-duplicate-${inv.id}`} title="Duplikuj"><Copy className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); correct(inv); }} data-testid={`button-correct-${inv.id}`} title="Korekta"><FileWarning className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); generatePDF(inv); }} data-testid={`button-pdf-${inv.id}`} title="PDF"><FileDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Czy na pewno chcesz usunąć tę fakturę?")) deleteMutation.mutate(inv.id); }} data-testid={`button-delete-${inv.id}`} title="Usuń"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ) },
        ]}
        searchable={true}
        searchKeys={["invoiceNumber", "buyerName"]}
        exportable={true}
        exportFileName="faktury"
        pageSize={25}
        emptyMessage="Brak faktur do wyświetlenia"
        isLoading={isLoading}
      />
    </div>
  );
}

export default Invoices;
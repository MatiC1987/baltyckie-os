import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileDown, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice } from "@shared/schema";
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

function statusBadge(status: string) {
  switch (status) {
    case "OPLACONA":
      return <Badge data-testid={`badge-status-${status}`}>Opłacona</Badge>;
    case "ANULOWANA":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Anulowana</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Wystawiona</Badge>;
  }
}

export default function Invoices() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    sellerName: "Bałtyckie Apartamenty",
    sellerNip: "",
    sellerAddress: "",
    buyerName: "",
    buyerNip: "",
    buyerAddress: "",
    itemName: "",
    itemQuantity: "1",
    itemUnitPrice: "",
    vatRate: "23",
    notes: "",
  });

  const { data: invoicesData = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const filteredInvoices = statusFilter === "all"
    ? invoicesData
    : invoicesData.filter(inv => inv.status === statusFilter);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDialogOpen(false);
      toast({ title: "Faktura utworzona" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się utworzyć faktury", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Faktura usunięta" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć faktury", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Status faktury zaktualizowany" });
    },
  });

  const handleSubmit = () => {
    const netAmount = Number(formData.itemQuantity) * Number(formData.itemUnitPrice);
    const vatRateNum = Number(formData.vatRate);
    const vatAmount = Math.round(netAmount * vatRateNum) / 100;
    const grossAmount = netAmount + vatAmount;

    const items = JSON.stringify([{
      name: formData.itemName,
      quantity: Number(formData.itemQuantity),
      unitPrice: Number(formData.itemUnitPrice),
      netAmount,
      vatRate: `${vatRateNum}%`,
      vatAmount,
      grossAmount,
    }]);

    createMutation.mutate({
      invoiceNumber: formData.invoiceNumber,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      sellerName: formData.sellerName,
      sellerNip: formData.sellerNip || null,
      sellerAddress: formData.sellerAddress || null,
      buyerName: formData.buyerName,
      buyerNip: formData.buyerNip || null,
      buyerAddress: formData.buyerAddress || null,
      items,
      netAmount: netAmount.toFixed(2),
      vatRate: `${vatRateNum}%`,
      vatAmount: vatAmount.toFixed(2),
      grossAmount: grossAmount.toFixed(2),
      status: "WYSTAWIONA",
      notes: formData.notes || null,
    });
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
    try {
      lineItems = JSON.parse(invoice.items);
    } catch {}

    const tableData = lineItems.map((item: any, i: number) => [
      i + 1,
      rd(item.name || ""),
      item.quantity || 1,
      formatPLN(item.unitPrice),
      formatPLN(item.netAmount),
      item.vatRate || "23%",
      formatPLN(item.vatAmount),
      formatPLN(item.grossAmount),
    ]);

    (doc as any).autoTable({
      startY: 78,
      head: [[rd("Lp."), rd("Nazwa"), rd("Ilosc"), rd("Cena jed."), rd("Netto"), rd("VAT%"), rd("VAT"), rd("Brutto")]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;

    doc.setFontSize(11);
    doc.text(rd(`Netto: ${formatPLN(invoice.netAmount)}`), 130, finalY + 10);
    doc.text(rd(`VAT (${invoice.vatRate || "23%"}): ${formatPLN(invoice.vatAmount)}`), 130, finalY + 16);
    doc.setFontSize(12);
    doc.text(rd(`Brutto: ${formatPLN(invoice.grossAmount)}`), 130, finalY + 24);

    if (invoice.notes) {
      doc.setFontSize(9);
      doc.text(rd(`Uwagi: ${invoice.notes}`), 14, finalY + 36);
    }

    doc.save(`faktura_${invoice.invoiceNumber.replace(/\//g, "_")}.pdf`);
    toast({ title: "PDF wygenerowany" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-invoices">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-invoices">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Faktury</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filtruj status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="WYSTAWIONA">Wystawiona</SelectItem>
              <SelectItem value="OPLACONA">Opłacona</SelectItem>
              <SelectItem value="ANULOWANA">Anulowana</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-invoice">
                <Plus className="h-4 w-4 mr-2" />
                Nowa faktura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nowa faktura</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nr faktury</Label>
                  <Input
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="FV/2026/02/001"
                    data-testid="input-invoice-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stawka VAT (%)</Label>
                  <Input
                    type="number"
                    value={formData.vatRate}
                    onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                    data-testid="input-vat-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data wystawienia</Label>
                  <Input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    data-testid="input-issue-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Termin płatności</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    data-testid="input-due-date"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Sprzedawca</Label>
                  <Input
                    value={formData.sellerName}
                    onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
                    data-testid="input-seller-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIP sprzedawcy</Label>
                  <Input
                    value={formData.sellerNip}
                    onChange={(e) => setFormData({ ...formData, sellerNip: e.target.value })}
                    data-testid="input-seller-nip"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adres sprzedawcy</Label>
                  <Input
                    value={formData.sellerAddress}
                    onChange={(e) => setFormData({ ...formData, sellerAddress: e.target.value })}
                    data-testid="input-seller-address"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nabywca</Label>
                  <Input
                    value={formData.buyerName}
                    onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                    data-testid="input-buyer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIP nabywcy</Label>
                  <Input
                    value={formData.buyerNip}
                    onChange={(e) => setFormData({ ...formData, buyerNip: e.target.value })}
                    data-testid="input-buyer-nip"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adres nabywcy</Label>
                  <Input
                    value={formData.buyerAddress}
                    onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
                    data-testid="input-buyer-address"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Nazwa pozycji</Label>
                  <Input
                    value={formData.itemName}
                    onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    placeholder="np. Usługa noclegowa"
                    data-testid="input-item-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ilość</Label>
                  <Input
                    type="number"
                    value={formData.itemQuantity}
                    onChange={(e) => setFormData({ ...formData, itemQuantity: e.target.value })}
                    data-testid="input-item-quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cena jednostkowa netto (PLN)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.itemUnitPrice}
                    onChange={(e) => setFormData({ ...formData, itemUnitPrice: e.target.value })}
                    data-testid="input-item-unit-price"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Uwagi</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                  Anuluj
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !formData.invoiceNumber || !formData.buyerName || !formData.itemUnitPrice}
                  data-testid="button-submit-invoice"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Utwórz fakturę
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista faktur</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-invoices">
              Brak faktur do wyświetlenia
            </p>
          ) : (
            <Table data-testid="table-invoices">
              <TableHeader>
                <TableRow>
                  <TableHead>Nr faktury</TableHead>
                  <TableHead>Data wystawienia</TableHead>
                  <TableHead>Nabywca</TableHead>
                  <TableHead>Kwota brutto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                    <TableCell data-testid={`text-invoice-number-${invoice.id}`}>{invoice.invoiceNumber}</TableCell>
                    <TableCell data-testid={`text-issue-date-${invoice.id}`}>{invoice.issueDate}</TableCell>
                    <TableCell data-testid={`text-buyer-name-${invoice.id}`}>{invoice.buyerName}</TableCell>
                    <TableCell data-testid={`text-gross-amount-${invoice.id}`}>{formatPLN(invoice.grossAmount)}</TableCell>
                    <TableCell>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: invoice.id, status: value })}
                      >
                        <SelectTrigger className="w-[140px] border-0 p-0 h-auto" data-testid={`select-status-${invoice.id}`}>
                          {statusBadge(invoice.status)}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WYSTAWIONA">Wystawiona</SelectItem>
                          <SelectItem value="OPLACONA">Opłacona</SelectItem>
                          <SelectItem value="ANULOWANA">Anulowana</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => generatePDF(invoice)}
                          data-testid={`button-pdf-${invoice.id}`}
                          title="Pobierz PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Czy na pewno chcesz usunąć tę fakturę?")) {
                              deleteMutation.mutate(invoice.id);
                            }
                          }}
                          data-testid={`button-delete-${invoice.id}`}
                          title="Usuń"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

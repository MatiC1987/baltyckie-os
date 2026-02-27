import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Search, Download, Pencil, Trash2, Eye, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Customer, InsertCustomer } from "@shared/schema";

const SEGMENTS = ["VIP", "Stały", "Nowy", "Firma", "Okazjonalny"] as const;

function segmentVariant(seg?: string | null): "default" | "secondary" | "outline" {
  if (seg === "VIP") return "default";
  if (seg === "Firma") return "secondary";
  return "outline";
}

export default function Customers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCustomer) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Dodano klienta" });
      setFormOpen(false);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się dodać klienta", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<InsertCustomer> & { id: number }) =>
      apiRequest("PATCH", `/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Zaktualizowano klienta" });
      setEditing(null);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się zaktualizować", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Usunięto klienta" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się usunąć", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = customers;
    if (segmentFilter !== "all") {
      list = list.filter((c) => c.segment === segmentFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q)) ||
          (c.phone?.toLowerCase().includes(q)) ||
          (c.companyName?.toLowerCase().includes(q)) ||
          (c.nip?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [customers, search, segmentFilter]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const sep = ";";
    const headers = ["Imię", "Nazwisko", "Email", "Telefon", "Firma", "NIP", "Segment", "Pobyty", "Przychód", "Ostatni pobyt"];
    const rows = filtered.map((c) => [
      c.firstName,
      c.lastName,
      c.email || "",
      c.phone || "",
      c.companyName || "",
      c.nip || "",
      c.segment || "",
      String(c.totalStays ?? 0),
      String(c.totalRevenue ?? 0),
      c.lastStayDate || "",
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers.join(sep), ...rows.map((r) => r.join(sep))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klienci.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && !customers) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Baza klientów"
        description="Zarządzanie klientami i relacjami (CRM)."
        icon={Users}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={exportCsv} data-testid="button-export-csv">
              <Download className="mr-2 h-4 w-4" /> Eksport CSV
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="button-add-customer">
              <Plus className="mr-2 h-4 w-4" /> Dodaj klienta
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwisku, email, telefonie, firmie, NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-customers"
          />
        </div>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-segment-filter">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie segmenty</SelectItem>
            {SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="Brak klientów"
          description={search || segmentFilter !== "all" ? "Brak wyników dla podanych filtrów." : "Dodaj pierwszego klienta."}
          actionLabel="Dodaj klienta"
          onAction={() => { setEditing(null); setFormOpen(true); }}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Pobyty</TableHead>
                <TableHead className="text-right">Przychód</TableHead>
                <TableHead>Ostatni pobyt</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} data-testid={`row-customer-${c.id}`} className="hover-elevate">
                  <TableCell className="font-medium whitespace-nowrap" data-testid={`text-customer-name-${c.id}`}>
                    {c.firstName} {c.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.companyName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.nip || "—"}</TableCell>
                  <TableCell>
                    {c.segment ? (
                      <Badge variant={segmentVariant(c.segment)} data-testid={`badge-segment-${c.id}`}>
                        {c.segment}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-stays-${c.id}`}>{c.totalStays ?? 0}</TableCell>
                  <TableCell className="text-right whitespace-nowrap" data-testid={`text-revenue-${c.id}`}>
                    {Number(c.totalRevenue ?? 0).toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {c.lastStayDate || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDetailCustomer(c)} data-testid={`button-view-customer-${c.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }} data-testid={`button-edit-customer-${c.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(c)} data-testid={`button-delete-customer-${c.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AnimatePresence>
        {formOpen && (
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent asChild>
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edytuj klienta" : "Dodaj klienta"}</DialogTitle>
                </DialogHeader>
                <CustomerForm
                  initial={editing}
                  isPending={editing ? updateMutation.isPending : createMutation.isPending}
                  onSubmit={(data) => {
                    if (editing) {
                      updateMutation.mutate({ id: editing.id, ...data });
                    } else {
                      createMutation.mutate(data);
                    }
                  }}
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <Dialog open={!!detailCustomer} onOpenChange={(open) => { if (!open) setDetailCustomer(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Szczegóły klienta</DialogTitle>
          </DialogHeader>
          {detailCustomer && <CustomerDetail customer={detailCustomer} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno chcesz usunąć klienta <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>? Tej operacji nie można cofnąć.
          </p>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="button-cancel-delete">
              Anuluj
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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

function CustomerForm({
  initial,
  isPending,
  onSubmit,
}: {
  initial: Customer | null;
  isPending: boolean;
  onSubmit: (data: InsertCustomer) => void;
}) {
  const [form, setForm] = useState<InsertCustomer>({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    companyName: initial?.companyName ?? "",
    nip: initial?.nip ?? "",
    street: initial?.street ?? "",
    city: initial?.city ?? "",
    postalCode: initial?.postalCode ?? "",
    country: initial?.country ?? "Polska",
    segment: initial?.segment ?? "",
    notes: initial?.notes ?? "",
    totalStays: initial?.totalStays ?? 0,
    totalRevenue: initial?.totalRevenue ?? "0",
    lastStayDate: initial?.lastStayDate ?? null,
  });

  const set = (key: keyof InsertCustomer, val: string | number | null) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label>Imię *</Label>
        <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} data-testid="input-customer-firstName" />
      </div>
      <div className="space-y-1">
        <Label>Nazwisko *</Label>
        <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} data-testid="input-customer-lastName" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} data-testid="input-customer-email" />
      </div>
      <div className="space-y-1">
        <Label>Telefon</Label>
        <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} data-testid="input-customer-phone" />
      </div>
      <div className="space-y-1">
        <Label>Firma</Label>
        <Input value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} data-testid="input-customer-company" />
      </div>
      <div className="space-y-1">
        <Label>NIP</Label>
        <Input value={form.nip ?? ""} onChange={(e) => set("nip", e.target.value)} data-testid="input-customer-nip" />
      </div>
      <div className="space-y-1">
        <Label>Ulica</Label>
        <Input value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} data-testid="input-customer-street" />
      </div>
      <div className="space-y-1">
        <Label>Miasto</Label>
        <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} data-testid="input-customer-city" />
      </div>
      <div className="space-y-1">
        <Label>Kod pocztowy</Label>
        <Input value={form.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} data-testid="input-customer-postalCode" />
      </div>
      <div className="space-y-1">
        <Label>Kraj</Label>
        <Input value={form.country ?? "Polska"} onChange={(e) => set("country", e.target.value)} data-testid="input-customer-country" />
      </div>
      <div className="space-y-1">
        <Label>Segment</Label>
        <Select value={form.segment ?? ""} onValueChange={(v) => set("segment", v)}>
          <SelectTrigger data-testid="select-customer-segment">
            <SelectValue placeholder="Wybierz segment" />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Notatki</Label>
        <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} data-testid="input-customer-notes" />
      </div>
      <DialogFooter className="col-span-2">
        <Button type="submit" disabled={isPending} data-testid="button-submit-customer">
          {isPending ? "Zapisywanie..." : initial ? "Zapisz zmiany" : "Dodaj klienta"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CustomerDetail({ customer: c }: { customer: Customer }) {
  const { data: stayData, isLoading: stayLoading } = useQuery<{
    history: Array<{
      id: number;
      reservationNumber: string;
      apartmentName: string;
      startDate: string;
      endDate: string;
      price: string;
      status: string;
      source: string | null;
    }>;
    totalRevenue: number;
    totalStays: number;
  }>({
    queryKey: ["/api/customers", c.id, "stay-history"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${c.id}/stay-history`);
      if (!res.ok) throw new Error("Błąd pobierania historii");
      return res.json();
    },
  });

  const fields: [string, string | number | null | undefined][] = [
    ["Imię", c.firstName],
    ["Nazwisko", c.lastName],
    ["Email", c.email],
    ["Telefon", c.phone],
    ["Firma", c.companyName],
    ["NIP", c.nip],
    ["Ulica", c.street],
    ["Miasto", c.city],
    ["Kod pocztowy", c.postalCode],
    ["Kraj", c.country],
    ["Segment", c.segment],
    ["Notatki", c.notes],
  ];

  return (
    <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {fields.map(([label, val]) => (
          <div key={label}>
            <span className="text-muted-foreground">{label}:</span>{" "}
            <span className="font-medium" data-testid={`detail-${label.toLowerCase().replace(/\s/g, "-")}`}>
              {val || "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <h4 className="text-sm font-semibold mb-3">Historia pobytów</h4>
        {stayLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-8 loading-shimmer rounded" />)}
          </div>
        ) : stayData && stayData.history.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Pobyty</p>
                <p className="text-lg font-bold" data-testid="text-total-stays">{stayData.totalStays}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Przychód</p>
                <p className="text-lg font-bold" data-testid="text-total-revenue">
                  {stayData.totalRevenue.toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Ostatni pobyt</p>
                <p className="text-sm font-medium" data-testid="text-last-stay">
                  {stayData.history[0]?.startDate || "—"}
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nr rezerwacji</TableHead>
                  <TableHead className="text-xs">Apartament</TableHead>
                  <TableHead className="text-xs">Od</TableHead>
                  <TableHead className="text-xs">Do</TableHead>
                  <TableHead className="text-xs text-right">Cena</TableHead>
                  <TableHead className="text-xs">Źródło</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stayData.history.map((stay) => (
                  <TableRow key={stay.id} data-testid={`row-stay-${stay.id}`}>
                    <TableCell className="text-xs font-mono">{stay.reservationNumber}</TableCell>
                    <TableCell className="text-xs">{stay.apartmentName}</TableCell>
                    <TableCell className="text-xs">{stay.startDate}</TableCell>
                    <TableCell className="text-xs">{stay.endDate}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {Number(stay.price).toLocaleString("pl-PL")} PLN
                    </TableCell>
                    <TableCell className="text-xs">
                      {stay.source ? <Badge variant="outline" className="text-[10px]">{stay.source}</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Brak dopasowanych rezerwacji dla tego klienta.</p>
        )}
      </div>
    </div>
  );
}

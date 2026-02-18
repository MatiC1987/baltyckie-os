import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, GripVertical, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ServiceContract, ServiceContractCategory } from "@shared/schema";

function useServiceContracts() {
  return useQuery<ServiceContract[]>({ queryKey: ["/api/service-contracts"] });
}

function useServiceContractCategories() {
  return useQuery<ServiceContractCategory[]>({ queryKey: ["/api/service-contract-categories"] });
}

export default function ServiceContracts() {
  const { data: contracts, isLoading: loadingContracts } = useServiceContracts();
  const { data: categories, isLoading: loadingCats } = useServiceContractCategories();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [showAddContract, setShowAddContract] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showReorderCategories, setShowReorderCategories] = useState(false);
  const [editingContract, setEditingContract] = useState<ServiceContract | null>(null);

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", "/api/service-contract-categories", { ...data, sortOrder: (categories?.length || 0) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contract-categories"] });
      toast({ title: "Sukces", description: "Kategoria dodana" });
      setShowAddCategory(false);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się dodać kategorii", variant: "destructive" }),
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/service-contracts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      toast({ title: "Sukces", description: "Umowa dodana" });
      setShowAddContract(false);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się dodać umowy", variant: "destructive" }),
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/service-contracts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      toast({ title: "Sukces", description: "Umowa zaktualizowana" });
      setEditingContract(null);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się zaktualizować umowy", variant: "destructive" }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/service-contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-contracts"] });
      toast({ title: "Sukces", description: "Umowa usunięta" });
    },
  });

  const isLoading = loadingContracts || loadingCats;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  const getCategoryName = (catId: number | null) => {
    if (!catId) return "Bez kategorii";
    return categories?.find(c => c.id === catId)?.name || "Bez kategorii";
  };

  const filteredContracts = activeTab === "all"
    ? contracts || []
    : (contracts || []).filter(c => {
        const cat = categories?.find(ct => ct.id === c.categoryId);
        return cat?.name === activeTab;
      });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-service-contracts-title">Umowy (usługi)</h2>
          <p className="text-muted-foreground text-sm">Zarządzanie umowami na usługi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowReorderCategories(true)} data-testid="button-reorder-categories">
            <Settings className="mr-2 h-4 w-4" /> Kolejność kategorii
          </Button>
          <Button variant="outline" onClick={() => setShowAddCategory(true)} data-testid="button-add-category">
            <Plus className="mr-2 h-4 w-4" /> Dodaj kategorię
          </Button>
          <Button onClick={() => setShowAddContract(true)} data-testid="button-add-service-contract">
            <Plus className="mr-2 h-4 w-4" /> Dodaj umowę
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="service-contracts-tabs" className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          {categories?.map(cat => (
            <TabsTrigger key={cat.id} value={cat.name} data-testid={`tab-category-${cat.id}`}>
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Data podpisania</TableHead>
                  <TableHead>Długość umowy</TableHead>
                  <TableHead>Data zakończenia</TableHead>
                  <TableHead>Adres usługi</TableHead>
                  <TableHead>Cena /miesiąc</TableHead>
                  <TableHead className="w-16">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map(contract => (
                  <TableRow key={contract.id} data-testid={`row-service-contract-${contract.id}`}>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell className="text-muted-foreground">{getCategoryName(contract.categoryId)}</TableCell>
                    <TableCell>{contract.signDate || "—"}</TableCell>
                    <TableCell>{contract.duration || "—"}</TableCell>
                    <TableCell>{contract.endDate || "—"}</TableCell>
                    <TableCell>{contract.serviceAddress || "—"}</TableCell>
                    <TableCell className="font-semibold">
                      {contract.monthlyPrice ? `${Number(contract.monthlyPrice).toFixed(2)} PLN` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditingContract(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteContractMutation.mutate(contract.id)} data-testid={`button-delete-contract-${contract.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Brak umów w tej kategorii.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>

      <AddCategoryDialog
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSubmit={(name) => createCategoryMutation.mutate({ name })}
        isPending={createCategoryMutation.isPending}
      />

      <AddContractDialog
        open={showAddContract}
        onClose={() => setShowAddContract(false)}
        onSubmit={(data) => createContractMutation.mutate(data)}
        isPending={createContractMutation.isPending}
        categories={categories || []}
      />

      <EditContractDialog
        contract={editingContract}
        onClose={() => setEditingContract(null)}
        onSubmit={(data) => {
          if (editingContract) updateContractMutation.mutate({ id: editingContract.id, data });
        }}
        isPending={updateContractMutation.isPending}
        categories={categories || []}
      />

      <ReorderCategoriesDialog
        open={showReorderCategories}
        onClose={() => setShowReorderCategories(false)}
        categories={categories || []}
      />
    </div>
  );
}

function AddCategoryDialog({ open, onClose, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dodaj kategorię</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nazwa kategorii</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Vectra" data-testid="input-category-name" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-category">
              {isPending ? "Zapisywanie..." : "Dodaj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddContractDialog({ open, onClose, onSubmit, isPending, categories }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  categories: ServiceContractCategory[];
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [signDate, setSignDate] = useState("");
  const [duration, setDuration] = useState("");
  const [endDate, setEndDate] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      categoryId: categoryId ? Number(categoryId) : null,
      signDate: signDate || null,
      duration: duration.trim() || null,
      endDate: endDate || null,
      serviceAddress: serviceAddress.trim() || null,
      monthlyPrice: monthlyPrice ? monthlyPrice : null,
    });
    setName("");
    setCategoryId("");
    setSignDate("");
    setDuration("");
    setEndDate("");
    setServiceAddress("");
    setMonthlyPrice("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dodaj umowę</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nazwa</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa umowy" data-testid="input-contract-name" />
          </div>
          <div className="space-y-2">
            <Label>Kategoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-contract-category">
                <SelectValue placeholder="Wybierz kategorię" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data podpisania umowy</Label>
              <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} data-testid="input-contract-sign-date" />
            </div>
            <div className="space-y-2">
              <Label>Długość umowy</Label>
              <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="np. 24 miesiące" data-testid="input-contract-duration" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data zakończenia umowy</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-contract-end-date" />
            </div>
            <div className="space-y-2">
              <Label>Cena usługi (/miesiąc)</Label>
              <Input type="number" step="0.01" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} placeholder="0.00" data-testid="input-contract-price" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adres świadczenia usługi</Label>
            <Input value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="Adres" data-testid="input-contract-address" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-contract">
              {isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditContractDialog({ contract, onClose, onSubmit, isPending, categories }: {
  contract: ServiceContract | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  categories: ServiceContractCategory[];
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [signDate, setSignDate] = useState("");
  const [duration, setDuration] = useState("");
  const [endDate, setEndDate] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");

  useEffect(() => {
    if (contract) {
      setName(contract.name);
      setCategoryId(contract.categoryId ? contract.categoryId.toString() : "");
      setSignDate(contract.signDate || "");
      setDuration(contract.duration || "");
      setEndDate(contract.endDate || "");
      setServiceAddress(contract.serviceAddress || "");
      setMonthlyPrice(contract.monthlyPrice ? contract.monthlyPrice.toString() : "");
    }
  }, [contract]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      categoryId: categoryId ? Number(categoryId) : null,
      signDate: signDate || null,
      duration: duration.trim() || null,
      endDate: endDate || null,
      serviceAddress: serviceAddress.trim() || null,
      monthlyPrice: monthlyPrice ? monthlyPrice : null,
    });
  };

  const handleClose = () => {
    setName("");
    setCategoryId("");
    setSignDate("");
    setDuration("");
    setEndDate("");
    setServiceAddress("");
    setMonthlyPrice("");
    onClose();
  };

  return (
    <Dialog open={!!contract} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-contract-title">Edytuj umowę</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nazwa</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa umowy" data-testid="edit-input-contract-name" />
          </div>
          <div className="space-y-2">
            <Label>Kategoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="edit-select-contract-category">
                <SelectValue placeholder="Wybierz kategorię" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data podpisania umowy</Label>
              <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} data-testid="edit-input-contract-sign-date" />
            </div>
            <div className="space-y-2">
              <Label>Długość umowy</Label>
              <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="np. 24 miesiące" data-testid="edit-input-contract-duration" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data zakończenia umowy</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="edit-input-contract-end-date" />
            </div>
            <div className="space-y-2">
              <Label>Cena usługi (/miesiąc)</Label>
              <Input type="number" step="0.01" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} placeholder="0.00" data-testid="edit-input-contract-price" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adres świadczenia usługi</Label>
            <Input value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="Adres" data-testid="edit-input-contract-address" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={handleClose} data-testid="button-cancel-edit-contract">Anuluj</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-edit-contract">
              {isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReorderCategoriesDialog({ open, onClose, categories }: {
  open: boolean;
  onClose: () => void;
  categories: ServiceContractCategory[];
}) {
  const [orderedCats, setOrderedCats] = useState<ServiceContractCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setOrderedCats([...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    }
  }, [open, categories]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setOrderedCats(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= orderedCats.length - 1) return;
    setOrderedCats(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        orderedCats.map((cat, idx) =>
          apiRequest("PUT", `/api/service-contract-categories/${cat.id}`, { sortOrder: idx })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/service-contract-categories"] });
      toast({ title: "Sukces", description: "Kolejność kategorii zapisana" });
      onClose();
    } catch {
      toast({ title: "Błąd", description: "Nie udało się zapisać kolejności", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kolejność kategorii</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          {orderedCats.map((cat, idx) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              data-testid={`reorder-category-${cat.id}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm">{cat.name}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                data-testid={`button-move-up-${cat.id}`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => moveDown(idx)}
                disabled={idx === orderedCats.length - 1}
                data-testid={`button-move-down-${cat.id}`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-reorder">
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useExpenses, useCreateExpense } from "@/hooks/use-expenses";
import { useAccounts, useCreateAccount, useAccountSnapshots, useCreateSnapshot } from "@/hooks/use-accounts";
import { useApartments } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wallet, CreditCard, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExpenseSchema, insertAccountSchema, insertAccountSnapshotSchema, type InsertExpense, type InsertAccount, type InsertAccountSnapshot } from "@shared/schema";

export default function Finance() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-finance-title">Finanse</h2>
        <p className="text-muted-foreground">Koszty, konta bankowe i salda.</p>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList data-testid="tabs-finance">
          <TabsTrigger value="expenses" data-testid="tab-expenses">Koszty</TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-accounts">Konta</TabsTrigger>
          <TabsTrigger value="snapshots" data-testid="tab-snapshots">Salda</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesSection />
        </TabsContent>
        <TabsContent value="accounts" className="mt-6">
          <AccountsSection />
        </TabsContent>
        <TabsContent value="snapshots" className="mt-6">
          <SnapshotsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpensesSection() {
  const { data: expenses, isLoading } = useExpenses();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Data",
      accessorKey: "date" as const,
    },
    {
      header: "Kategoria",
      cell: (e: any) => (
        <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted">{e.category}</span>
      ),
    },
    {
      header: "Opis",
      accessorKey: "description" as const,
    },
    {
      header: "Kwota",
      cell: (e: any) => <span className="font-bold text-destructive">{e.amount} PLN</span>
    },
    {
      header: "Typ",
      cell: (e: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.type === 'FIXED' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
          {e.type === 'FIXED' ? 'Staly' : 'Zmienny'}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="mr-2 h-4 w-4" /> Dodaj koszt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nowy koszt</DialogTitle>
            </DialogHeader>
            <ExpenseForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable data={expenses || []} columns={columns} isLoading={isLoading} emptyMessage="Brak kosztow." />
    </div>
  );
}

function ExpenseForm({ onSuccess }: { onSuccess: () => void }) {
  const createExpense = useCreateExpense();
  const { data: apartments } = useApartments();

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: "",
      amount: "0",
      description: "",
      type: "VARIABLE",
      vatAmount: "0",
    }
  });

  const onSubmit = (data: InsertExpense) => {
    createExpense.mutate(data, { onSuccess: () => onSuccess() });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" {...form.register("date")} data-testid="input-expense-date" />
        </div>
        <div className="space-y-2">
          <Label>Kategoria</Label>
          <Input {...form.register("category")} placeholder="np. Sprzatanie" data-testid="input-expense-category" />
        </div>
        <div className="space-y-2">
          <Label>Kwota (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("amount")} data-testid="input-expense-amount" />
        </div>
        <div className="space-y-2">
          <Label>Typ</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="select-expense-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Staly</SelectItem>
                  <SelectItem value="VARIABLE">Zmienny</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
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
          <Input {...form.register("description")} placeholder="Opis kosztu" data-testid="input-expense-description" />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={createExpense.isPending} data-testid="button-submit-expense">
          {createExpense.isPending ? "Zapisywanie..." : "Zapisz koszt"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AccountsSection() {
  const { data: accounts, isLoading } = useAccounts();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Nazwa",
      cell: (a: any) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="font-medium">{a.name}</span>
        </div>
      )
    },
    {
      header: "Typ",
      cell: (a: any) => <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted">{a.type}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="mr-2 h-4 w-4" /> Dodaj konto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nowe konto</DialogTitle>
            </DialogHeader>
            <AccountForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable data={accounts || []} columns={columns} isLoading={isLoading} emptyMessage="Brak kont." />
    </div>
  );
}

function AccountForm({ onSuccess }: { onSuccess: () => void }) {
  const createAccount = useCreateAccount();
  const form = useForm<InsertAccount>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: { name: "", type: "BANK" }
  });

  const onSubmit = (data: InsertAccount) => {
    createAccount.mutate(data, { onSuccess: () => onSuccess() });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Nazwa konta</Label>
        <Input {...form.register("name")} placeholder="np. PEKAO SA" data-testid="input-account-name" />
      </div>
      <div className="space-y-2">
        <Label>Typ</Label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || "BANK"}>
              <SelectTrigger data-testid="select-account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="CASH">Gotowka</SelectItem>
                <SelectItem value="LOAN">Pozyczka</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={createAccount.isPending} data-testid="button-submit-account">
          {createAccount.isPending ? "Zapisywanie..." : "Dodaj konto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SnapshotsSection() {
  const { data: snapshots, isLoading } = useAccountSnapshots();
  const { data: accounts } = useAccounts();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Data",
      accessorKey: "date" as const,
    },
    {
      header: "Konto",
      cell: (s: any) => {
        const acc = accounts?.find(a => a.id === s.accountId);
        return <span className="font-medium">{acc?.name || `#${s.accountId}`}</span>;
      }
    },
    {
      header: "Saldo",
      cell: (s: any) => <span className="font-bold">{s.balance} PLN</span>
    },
    {
      header: "Notatki",
      accessorKey: "notes" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-snapshot">
              <Plus className="mr-2 h-4 w-4" /> Dodaj saldo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nowy wpis salda</DialogTitle>
            </DialogHeader>
            <SnapshotForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable data={snapshots || []} columns={columns} isLoading={isLoading} emptyMessage="Brak wpisow salda." />
    </div>
  );
}

function SnapshotForm({ onSuccess }: { onSuccess: () => void }) {
  const createSnapshot = useCreateSnapshot();
  const { data: accounts } = useAccounts();

  const form = useForm<InsertAccountSnapshot>({
    resolver: zodResolver(insertAccountSnapshotSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      balance: "0",
      notes: "",
    }
  });

  const onSubmit = (data: InsertAccountSnapshot) => {
    createSnapshot.mutate(data, { onSuccess: () => onSuccess() });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Konto</Label>
        <Controller
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
              <SelectTrigger data-testid="select-snapshot-account">
                <SelectValue placeholder="Wybierz konto" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label>Data</Label>
        <Input type="date" {...form.register("date")} data-testid="input-snapshot-date" />
      </div>
      <div className="space-y-2">
        <Label>Saldo (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("balance")} data-testid="input-snapshot-balance" />
      </div>
      <div className="space-y-2">
        <Label>Notatki</Label>
        <Input {...form.register("notes")} placeholder="Opcjonalny komentarz" data-testid="input-snapshot-notes" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={createSnapshot.isPending} data-testid="button-submit-snapshot">
          {createSnapshot.isPending ? "Zapisywanie..." : "Zapisz saldo"}
        </Button>
      </DialogFooter>
    </form>
  );
}

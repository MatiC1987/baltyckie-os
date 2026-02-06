import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertAccount, type InsertAccountSnapshot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Accounts
export function useAccounts() {
  return useQuery({
    queryKey: [api.accounts.list.path],
    queryFn: async () => {
      const res = await fetch(api.accounts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return api.accounts.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      const res = await fetch(api.accounts.create.path, {
        method: api.accounts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create account");
      return api.accounts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      toast({ title: "Sukces", description: "Konto zostało dodane" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać konta", variant: "destructive" });
    }
  });
}

// Snapshots
export function useAccountSnapshots() {
  return useQuery({
    queryKey: [api.snapshots.list.path],
    queryFn: async () => {
      const res = await fetch(api.snapshots.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return api.snapshots.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAccountSnapshot) => {
      const res = await fetch(api.snapshots.create.path, {
        method: api.snapshots.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return api.snapshots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.snapshots.list.path] });
      toast({ title: "Sukces", description: "Stan konta został zapisany" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zapisać stanu konta", variant: "destructive" });
    }
  });
}

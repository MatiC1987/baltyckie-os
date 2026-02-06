import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertOwner, type Owner } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useOwners() {
  return useQuery({
    queryKey: [api.owners.list.path],
    queryFn: async () => {
      const res = await fetch(api.owners.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch owners");
      return res.json() as Promise<Owner[]>;
    },
  });
}

export function useCreateOwner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertOwner) => {
      const res = await fetch(api.owners.create.path, {
        method: api.owners.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create owner");
      return res.json() as Promise<Owner>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.owners.list.path] });
      toast({ title: "Sukces", description: "Właściciel został dodany" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać właściciela", variant: "destructive" });
    }
  });
}

export function useUpdateOwner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertOwner>) => {
      const url = buildUrl(api.owners.update.path, { id });
      const res = await fetch(url, {
        method: api.owners.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update owner");
      return res.json() as Promise<Owner>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.owners.list.path] });
      toast({ title: "Sukces", description: "Właściciel został zaktualizowany" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować właściciela", variant: "destructive" });
    }
  });
}

export function useDeleteOwner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.owners.delete.path, { id });
      const res = await fetch(url, {
        method: api.owners.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete owner");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.owners.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.apartments.list.path] });
      toast({ title: "Sukces", description: "Właściciel został usunięty" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć właściciela", variant: "destructive" });
    }
  });
}

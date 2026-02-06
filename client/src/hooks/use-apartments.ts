import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertApartment, type Apartment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useApartments() {
  return useQuery({
    queryKey: [api.apartments.list.path],
    queryFn: async () => {
      const res = await fetch(api.apartments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch apartments");
      return api.apartments.list.responses[200].parse(await res.json());
    },
  });
}

export function useApartment(id: number) {
  return useQuery({
    queryKey: [api.apartments.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.apartments.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch apartment");
      return api.apartments.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateApartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertApartment) => {
      const res = await fetch(api.apartments.create.path, {
        method: api.apartments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create apartment");
      return api.apartments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.apartments.list.path] });
      toast({ title: "Sukces", description: "Apartament został dodany" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać apartamentu", variant: "destructive" });
    }
  });
}

export function useUpdateApartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertApartment>) => {
      const url = buildUrl(api.apartments.update.path, { id });
      const res = await fetch(url, {
        method: api.apartments.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update apartment");
      return api.apartments.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.apartments.list.path] });
      toast({ title: "Sukces", description: "Apartament został zaktualizowany" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować apartamentu", variant: "destructive" });
    }
  });
}

export function useDeleteApartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.apartments.delete.path, { id });
      const res = await fetch(url, {
        method: api.apartments.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete apartment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.apartments.list.path] });
      toast({ title: "Sukces", description: "Apartament został usunięty" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć apartamentu", variant: "destructive" });
    }
  });
}

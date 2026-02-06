import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertLease } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useLeases() {
  return useQuery({
    queryKey: [api.leases.list.path],
    queryFn: async () => {
      const res = await fetch(api.leases.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leases");
      return api.leases.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertLease) => {
      const res = await fetch(api.leases.create.path, {
        method: api.leases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lease");
      return api.leases.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leases.list.path] });
      toast({ title: "Sukces", description: "Umowa najmu została dodana" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać umowy najmu", variant: "destructive" });
    }
  });
}

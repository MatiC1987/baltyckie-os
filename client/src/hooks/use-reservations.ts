import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertReservation, type Reservation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useReservations(filters?: { apartmentId?: number; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: [api.reservations.list.path, filters],
    queryFn: async () => {
      let url = api.reservations.list.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.apartmentId) params.append("apartmentId", filters.apartmentId.toString());
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reservations");
      return api.reservations.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertReservation) => {
      // Ensure numeric fields are correctly formatted/typed if needed by schema
      // Specifically for z.coerce in routes, we send strings or numbers, backend handles coerce
      const res = await fetch(api.reservations.create.path, {
        method: api.reservations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create reservation");
      return api.reservations.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reservations.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.dashboard.path] });
      toast({ title: "Sukces", description: "Rezerwacja została dodana" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać rezerwacji", variant: "destructive" });
    }
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.reservations.delete.path, { id });
      const res = await fetch(url, {
        method: api.reservations.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete reservation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reservations.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.dashboard.path] });
      toast({ title: "Sukces", description: "Rezerwacja została usunięta" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć rezerwacji", variant: "destructive" });
    }
  });
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hotel, Loader2, Search } from "lucide-react";

export default function RecepcjaRezerwacje() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "arrivals">("all");

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/reservations"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/reservations"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const getAptName = (id: number) => apartments.find((a: any) => a.id === id)?.name || '-';

  let filtered = reservations.filter((r: any) => r.status !== 'ANULOWANA');
  if (tab === "arrivals") {
    filtered = filtered.filter((r: any) => r.startDate === today);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((r: any) =>
      r.guestName?.toLowerCase().includes(q) || r.reservationNumber?.toLowerCase().includes(q)
    );
  }
  filtered.sort((a: any, b: any) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Hotel className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-rezerwacje-title">Rezerwacje</h1>
        <Badge variant="secondary">Tylko podgląd</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>
          Wszystkie
        </Button>
        <Button variant={tab === "arrivals" ? "default" : "outline"} size="sm" onClick={() => setTab("arrivals")}>
          Przyjazdy dziś
        </Button>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj gościa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8"
            data-testid="input-search-reservations"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Nr</th>
                <th className="p-2 text-left">Gość</th>
                <th className="p-2 text-left">Apartament</th>
                <th className="p-2 text-left">Przyjazd</th>
                <th className="p-2 text-left">Wyjazd</th>
                <th className="p-2 text-right">Cena</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 text-muted-foreground">{r.reservationNumber}</td>
                  <td className="p-2 font-medium">{r.guestName}</td>
                  <td className="p-2">{getAptName(r.apartmentId)}</td>
                  <td className="p-2">{r.startDate}</td>
                  <td className="p-2">{r.endDate}</td>
                  <td className="p-2 text-right">{Number(r.price).toFixed(2)} PLN</td>
                  <td className="p-2 text-center">
                    <Badge variant={r.status === 'PRZYJETA' ? 'default' : 'secondary'}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
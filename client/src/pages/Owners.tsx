import { useMemo } from "react";
import { useApartments } from "@/hooks/use-apartments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, MapPin } from "lucide-react";
import { type Apartment } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { type Lease } from "@shared/schema";

export default function Owners() {
  const { data: apartments, isLoading: aptsLoading } = useApartments();
  const { data: leases } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });

  const owners = useMemo(() => {
    if (!apartments) return [];
    const map = new Map<string, Apartment[]>();
    for (const apt of apartments) {
      const owner = apt.ownerName?.trim() || "Brak właściciela";
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner)!.push(apt);
    }
    return Array.from(map.entries())
      .map(([name, apts]) => ({ name, apartments: apts }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [apartments]);

  const getActiveLease = (aptId: number) => {
    if (!leases) return null;
    const today = new Date().toISOString().split('T')[0];
    return leases.find(l =>
      l.apartmentId === aptId &&
      l.startDate <= today &&
      (!l.endDate || l.endDate >= today)
    );
  };

  if (aptsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-owners-title">Właściciele</h2>
          <p className="text-muted-foreground">Lista właścicieli i ich apartamentów.</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 w-full bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-owners-title">Właściciele</h2>
        <p className="text-muted-foreground">Lista właścicieli i ich apartamentów.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-owners-count">{owners.length}</div>
            <div className="text-xs text-muted-foreground">Właścicieli</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-apartments-total">{apartments?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Apartamentów</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {owners.map((owner) => (
          <Card key={owner.name} data-testid={`card-owner-${owner.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{owner.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{owner.apartments.length} {owner.apartments.length === 1 ? 'apartament' : owner.apartments.length < 5 ? 'apartamenty' : 'apartamentów'}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {owner.apartments.map((apt) => {
                  const lease = getActiveLease(apt.id);
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg bg-muted/50"
                      data-testid={`row-owner-apartment-${apt.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{apt.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {apt.location || "Brak lokalizacji"}
                            {apt.address && <span>| {apt.address}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {lease && (
                          <Badge variant="outline" className="text-xs">
                            Najem: {lease.startDate} — {lease.endDate || "bezterminowo"}
                          </Badge>
                        )}
                        <Badge variant={apt.active ? "default" : "secondary"}>
                          {apt.active ? "Aktywny" : "Nieaktywny"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {owners.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Brak właścicieli. Dodaj apartamenty z przypisanym właścicielem.
          </div>
        )}
      </div>
    </div>
  );
}

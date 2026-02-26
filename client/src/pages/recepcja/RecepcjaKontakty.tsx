import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, Mail, Search, Loader2 } from "lucide-react";

export default function RecepcjaKontakty() {
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/tenant-contacts"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/tenant-contacts"); return r.json(); },
  });

  const filtered = search
    ? contacts.filter((c: any) => c.tenantName?.toLowerCase().includes(search.toLowerCase()) || c.apartmentName?.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  const grouped: Record<string, any[]> = {};
  filtered.forEach((c: any) => {
    const apt = c.apartmentName || 'Inne';
    if (!grouped[apt]) grouped[apt] = [];
    grouped[apt].push(c);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-kontakty-title">Kontakty najemców</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Szukaj najemcy lub apartamentu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" data-testid="input-search-contacts" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Brak aktywnych najemców</Card>
      ) : (
        Object.entries(grouped).map(([apt, tenants]) => (
          <Card key={apt} className="p-4">
            <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase">{apt}</h3>
            <div className="space-y-2">
              {tenants.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{t.tenantName}</div>
                    <div className="text-xs text-muted-foreground">{t.startDate} — {t.endDate}</div>
                  </div>
                  <div className="flex gap-3">
                    {t.phone && (
                      <a href={`tel:${t.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline" data-testid={`link-phone-${t.id}`}>
                        <Phone className="h-3.5 w-3.5" /> {t.phone}
                      </a>
                    )}
                    {t.email && (
                      <a href={`mailto:${t.email}`} className="flex items-center gap-1 text-sm text-primary hover:underline" data-testid={`link-email-${t.id}`}>
                        <Mail className="h-3.5 w-3.5" /> {t.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, CalendarDays, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Reservation, Apartment } from "@shared/schema";

type Sublease = {
  id: number;
  tenantName: string | null;
  apartmentId: number | null;
  apartmentIds: number[] | null;
};

type SearchResult = {
  type: "reservation" | "apartment" | "sublease";
  id: number;
  label: string;
  sublabel: string;
  href: string;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: reservations } = useQuery<Reservation[]>({ queryKey: ["/api/reservations"] });
  const { data: apartments } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: subleases } = useQuery<Sublease[]>({ queryKey: ["/api/subleases"] });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const items: SearchResult[] = [];

    apartments?.forEach(a => {
      if (a.name?.toLowerCase().includes(q) || a.address?.toLowerCase().includes(q)) {
        items.push({
          type: "apartment",
          id: a.id,
          label: a.name || `Apartament #${a.id}`,
          sublabel: a.address || "",
          href: "/apartments",
        });
      }
    });

    reservations?.forEach(r => {
      const num = r.reservationNumber || "";
      const guest = r.guestName || "";
      if (num.toLowerCase().includes(q) || guest.toLowerCase().includes(q)) {
        const aptName = apartments?.find(a => a.id === r.apartmentId)?.name || "";
        items.push({
          type: "reservation",
          id: r.id,
          label: `${num} - ${guest}`,
          sublabel: `${aptName} | ${r.startDate || ""} - ${r.endDate || ""}`,
          href: "/reservations",
        });
      }
    });

    subleases?.forEach(s => {
      const tenant = s.tenantName || "";
      if (tenant.toLowerCase().includes(q)) {
        items.push({
          type: "sublease",
          id: s.id,
          label: tenant,
          sublabel: "Podnajem",
          href: "/podnajem",
        });
      }
    });

    return items.slice(0, 10);
  }, [query, reservations, apartments, subleases]);

  const iconMap = {
    reservation: CalendarDays,
    apartment: Building2,
    sublease: Users,
  };

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setLocation(result.href);
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-muted-foreground text-sm hover-elevate transition-colors"
        data-testid="button-global-search"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Szukaj...</span>
        <kbd className="ml-4 text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm" data-testid="modal-global-search">
      <div ref={containerRef} className="w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Szukaj rezerwacji, apartamentów, najemców..."
            className="border-0 focus-visible:ring-0 text-sm h-11"
            data-testid="input-global-search"
          />
          <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground hover:text-foreground" data-testid="button-close-search">
            <X className="h-4 w-4" />
          </button>
        </div>

        {query.length >= 2 && (
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-results">
                Brak wyników dla "{query}"
              </div>
            ) : (
              <div className="py-1">
                {results.map(r => {
                  const Icon = iconMap[r.type];
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                      data-testid={`search-result-${r.type}-${r.id}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {query.length < 2 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Wpisz minimum 2 znaki aby wyszukać
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, ChevronRight, ArrowLeft, ChevronsUpDown, X } from "lucide-react";

interface AssignmentTargets {
  operational: {
    catId: string;
    title: string;
    items: {
      catId: string;
      itemIdx: number;
      name: string;
      subLabel?: string | null;
      realizedByMonth: Record<number, number>;
    }[];
  }[];
  apartment: {
    entryId: string;
    name: string;
    location?: string | null;
    categories: {
      category: string;
      realizedByMonth: Record<number, number>;
    }[];
  }[];
  sublease: {
    subleaseId: number;
    tenantName: string;
    apartmentNames: string;
    unpaidPayments: {
      id: number;
      title: string;
      category: string;
      amount: string;
      dueDate: string;
    }[];
  }[];
}

export interface WizardSelection {
  targetType: "operational" | "apartment" | "sublease";
  catId?: string;
  itemIdx?: number;
  entryId?: string;
  category?: string;
  subleasePaymentId?: number;
  subleaseId?: number;
  label: string;
}

interface CostTargetWizardProps {
  targets: AssignmentTargets | undefined;
  onSelect: (selection: WizardSelection) => void;
  value?: string;
  placeholder?: string;
  clearLabel?: string;
  onClear?: () => void;
  className?: string;
  triggerClassName?: string;
  txMonth?: number;
  "data-testid"?: string;
}

type WizardStep =
  | { type: "root" }
  | { type: "op-categories" }
  | { type: "op-items"; catId: string; catTitle: string }
  | { type: "apt-locations" }
  | { type: "apt-list"; location: string }
  | { type: "apt-categories"; entryId: string; aptName: string; location: string }
  | { type: "subleases" }
  | { type: "sublease-payments"; subleaseId: number; tenantName: string };

function formatPLN(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

export function CostTargetWizard({
  targets,
  onSelect,
  value,
  placeholder = "Wybierz pozycję...",
  clearLabel,
  onClear,
  className,
  triggerClassName,
  txMonth,
  "data-testid": dataTestId,
}: CostTargetWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>({ type: "root" });
  const [search, setSearch] = useState("");

  const resetWizard = useCallback(() => {
    setStep({ type: "root" });
    setSearch("");
  }, []);

  const handleOpenChange = useCallback((o: boolean) => {
    setOpen(o);
    if (!o) resetWizard();
  }, [resetWizard]);

  const breadcrumb = useMemo(() => {
    const parts: { label: string; step: WizardStep }[] = [];
    switch (step.type) {
      case "op-categories":
        parts.push({ label: "Operacyjne", step: { type: "root" } });
        break;
      case "op-items":
        parts.push({ label: "Operacyjne", step: { type: "root" } });
        parts.push({ label: step.catTitle, step: { type: "op-categories" } });
        break;
      case "apt-locations":
        parts.push({ label: "Apartamenty", step: { type: "root" } });
        break;
      case "apt-list":
        parts.push({ label: "Apartamenty", step: { type: "root" } });
        parts.push({ label: step.location, step: { type: "apt-locations" } });
        break;
      case "apt-categories":
        parts.push({ label: "Apartamenty", step: { type: "root" } });
        parts.push({ label: step.location, step: { type: "apt-locations" } });
        parts.push({ label: step.aptName, step: { type: "apt-list", location: step.location } });
        break;
      case "subleases":
        parts.push({ label: "Podnajmy", step: { type: "root" } });
        break;
      case "sublease-payments":
        parts.push({ label: "Podnajmy", step: { type: "root" } });
        parts.push({ label: step.tenantName, step: { type: "subleases" } });
        break;
    }
    return parts;
  }, [step]);

  const searchResults = useMemo(() => {
    if (!search.trim() || !targets) return [];
    const q = search.toLowerCase();
    const results: { key: string; label: string; group: string; selection: WizardSelection }[] = [];

    for (const cat of targets.operational) {
      for (const item of cat.items) {
        const text = `${cat.title} ${item.name} ${item.subLabel || ""}`.toLowerCase();
        if (text.includes(q)) {
          const realized = txMonth !== undefined ? (item.realizedByMonth[txMonth] || 0) : 0;
          results.push({
            key: `op__${item.catId}__${item.itemIdx}`,
            label: `${cat.title} → ${item.name}${item.subLabel ? ` (${item.subLabel})` : ""}${realized > 0 ? ` [${realized.toFixed(2)} zł]` : ""}`,
            group: "Operacyjne",
            selection: { targetType: "operational", catId: item.catId, itemIdx: item.itemIdx, label: `${cat.title} → ${item.name}` },
          });
        }
      }
    }

    for (const apt of targets.apartment) {
      for (const c of apt.categories) {
        const text = `${apt.name} ${apt.location || ""} ${c.category}`.toLowerCase();
        if (text.includes(q)) {
          const realized = txMonth !== undefined ? (c.realizedByMonth[txMonth] || 0) : 0;
          results.push({
            key: `apt__${apt.entryId}__${c.category}`,
            label: `${apt.name} → ${c.category}${realized > 0 ? ` [${realized.toFixed(2)} zł]` : ""}`,
            group: `Apartamenty${apt.location ? ` — ${apt.location}` : ""}`,
            selection: { targetType: "apartment", entryId: apt.entryId, category: c.category, label: `${apt.name} → ${c.category}` },
          });
        }
      }
    }

    for (const sub of targets.sublease) {
      for (const pay of sub.unpaidPayments) {
        const text = `${sub.tenantName} ${sub.apartmentNames} ${pay.title} ${pay.category}`.toLowerCase();
        if (text.includes(q)) {
          results.push({
            key: `sub__${pay.id}`,
            label: `${sub.tenantName} → ${pay.title} (${formatPLN(pay.amount)})`,
            group: "Podnajmy",
            selection: { targetType: "sublease", subleasePaymentId: pay.id, subleaseId: sub.subleaseId, label: `${sub.tenantName} → ${pay.title}` },
          });
        }
      }
    }

    return results;
  }, [search, targets, txMonth]);

  const locations = useMemo(() => {
    if (!targets) return [];
    const locMap: Record<string, number> = {};
    for (const apt of targets.apartment) {
      const loc = apt.location || "Inne";
      locMap[loc] = (locMap[loc] || 0) + 1;
    }
    return Object.entries(locMap).sort(([a], [b]) => a.localeCompare(b));
  }, [targets]);

  const handleSelect = useCallback((selection: WizardSelection) => {
    onSelect(selection);
    setOpen(false);
    resetWizard();
  }, [onSelect, resetWizard]);

  const Tile = ({ label, subtitle, onClick, testId }: { label: string; subtitle?: string; onClick: () => void; testId?: string }) => (
    <button
      className="flex items-center justify-between w-full px-2.5 py-1 text-left text-[13px] hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate leading-tight">{label}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</div>}
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-2 text-muted-foreground" />
    </button>
  );

  const LeafItem = ({ label, subtitle, onClick, testId }: { label: string; subtitle?: string; onClick: () => void; testId?: string }) => (
    <button
      className="flex items-center w-full px-2.5 py-1 text-left text-[13px] hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate leading-tight">{label}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</div>}
      </div>
    </button>
  );

  const renderContent = () => {
    if (!targets) return <div className="px-3 py-6 text-center text-sm text-muted-foreground">Ładowanie...</div>;

    if (search.trim()) {
      if (searchResults.length === 0) {
        return <div className="px-3 py-6 text-center text-sm text-muted-foreground">Brak wyników</div>;
      }
      const grouped: Record<string, typeof searchResults> = {};
      for (const r of searchResults) {
        if (!grouped[r.group]) grouped[r.group] = [];
        grouped[r.group].push(r);
      }
      return (
        <div className="space-y-1">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">{group}</div>
              {items.map(item => (
                <LeafItem
                  key={item.key}
                  label={item.label}
                  onClick={() => handleSelect(item.selection)}
                  testId={dataTestId ? `${dataTestId}-result-${item.key}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }

    switch (step.type) {
      case "root":
        return (
          <div className="space-y-1 p-1">
            {targets.operational.length > 0 && (
              <Tile
                label="Operacyjne"
                subtitle={`${targets.operational.length} kategorii`}
                onClick={() => { setStep({ type: "op-categories" }); }}
                testId={dataTestId ? `${dataTestId}-tile-operational` : undefined}
              />
            )}
            {targets.apartment.length > 0 && (
              <Tile
                label="Apartamenty"
                subtitle={`${targets.apartment.length} apartamentów`}
                onClick={() => { setStep({ type: "apt-locations" }); }}
                testId={dataTestId ? `${dataTestId}-tile-apartments` : undefined}
              />
            )}
            {targets.sublease.length > 0 && (
              <Tile
                label="Podnajmy"
                subtitle={`${targets.sublease.length} podnajmów`}
                onClick={() => { setStep({ type: "subleases" }); }}
                testId={dataTestId ? `${dataTestId}-tile-subleases` : undefined}
              />
            )}
          </div>
        );

      case "op-categories":
        return (
          <div className="space-y-1 p-1">
            {targets.operational.map(cat => (
              <Tile
                key={cat.catId}
                label={cat.title}
                subtitle={`${cat.items.length} pozycji`}
                onClick={() => { setStep({ type: "op-items", catId: cat.catId, catTitle: cat.title }); }}
                testId={dataTestId ? `${dataTestId}-tile-opcat-${cat.catId}` : undefined}
              />
            ))}
          </div>
        );

      case "op-items": {
        const cat = targets.operational.find(c => c.catId === step.catId);
        if (!cat) return null;
        return (
          <div className="space-y-0.5 p-1">
            {cat.items.map(item => {
              const realized = txMonth !== undefined ? (item.realizedByMonth[txMonth] || 0) : 0;
              return (
                <LeafItem
                  key={`${item.catId}-${item.itemIdx}`}
                  label={item.name}
                  subtitle={`${item.subLabel || ""}${realized > 0 ? ` • realizacja: ${realized.toFixed(2)} zł` : ""}`}
                  onClick={() => handleSelect({
                    targetType: "operational", catId: item.catId, itemIdx: item.itemIdx,
                    label: `${cat.title} → ${item.name}`,
                  })}
                  testId={dataTestId ? `${dataTestId}-item-op-${item.catId}-${item.itemIdx}` : undefined}
                />
              );
            })}
          </div>
        );
      }

      case "apt-locations":
        return (
          <div className="space-y-1 p-1">
            {locations.map(([loc, count]) => (
              <Tile
                key={loc}
                label={loc}
                subtitle={`${count} apartamentów`}
                onClick={() => { setStep({ type: "apt-list", location: loc }); }}
                testId={dataTestId ? `${dataTestId}-tile-loc-${loc}` : undefined}
              />
            ))}
          </div>
        );

      case "apt-list": {
        const apts = targets.apartment
          .filter(a => (a.location || "Inne") === step.location)
          .sort((a, b) => a.name.localeCompare(b.name));
        return (
          <div className="space-y-1 p-1">
            {apts.map(apt => (
              <Tile
                key={apt.entryId}
                label={apt.name}
                subtitle={`${apt.categories.length} kategorii kosztowych`}
                onClick={() => { setStep({ type: "apt-categories", entryId: apt.entryId, aptName: apt.name, location: step.location }); }}
                testId={dataTestId ? `${dataTestId}-tile-apt-${apt.entryId}` : undefined}
              />
            ))}
          </div>
        );
      }

      case "apt-categories": {
        const apt = targets.apartment.find(a => a.entryId === step.entryId);
        if (!apt) return null;
        return (
          <div className="space-y-0.5 p-1">
            {apt.categories.map(c => {
              const realized = txMonth !== undefined ? (c.realizedByMonth[txMonth] || 0) : 0;
              return (
                <LeafItem
                  key={c.category}
                  label={c.category}
                  subtitle={realized > 0 ? `realizacja: ${realized.toFixed(2)} zł` : undefined}
                  onClick={() => handleSelect({
                    targetType: "apartment", entryId: apt.entryId, category: c.category,
                    label: `${apt.name} → ${c.category}`,
                  })}
                  testId={dataTestId ? `${dataTestId}-item-apt-${apt.entryId}-${c.category}` : undefined}
                />
              );
            })}
          </div>
        );
      }

      case "subleases":
        return (
          <div className="space-y-1 p-1">
            {targets.sublease.map(sub => (
              <Tile
                key={sub.subleaseId}
                label={sub.tenantName}
                subtitle={`${sub.apartmentNames} • ${sub.unpaidPayments.length} nieopłaconych`}
                onClick={() => { setStep({ type: "sublease-payments", subleaseId: sub.subleaseId, tenantName: sub.tenantName }); }}
                testId={dataTestId ? `${dataTestId}-tile-sub-${sub.subleaseId}` : undefined}
              />
            ))}
          </div>
        );

      case "sublease-payments": {
        const sub = targets.sublease.find(s => s.subleaseId === step.subleaseId);
        if (!sub) return null;
        return (
          <div className="space-y-0.5 p-1">
            {sub.unpaidPayments.map(pay => (
              <LeafItem
                key={pay.id}
                label={`${pay.title} — ${formatPLN(pay.amount)}`}
                subtitle={`termin: ${pay.dueDate}`}
                onClick={() => handleSelect({
                  targetType: "sublease", subleasePaymentId: pay.id, subleaseId: sub.subleaseId,
                  label: `${sub.tenantName} → ${pay.title}`,
                })}
                testId={dataTestId ? `${dataTestId}-item-sub-${pay.id}` : undefined}
              />
            ))}
          </div>
        );
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", triggerClassName)}
          data-testid={dataTestId}
        >
          <span className="truncate text-left flex-1">
            {value ? (
              <span className="flex items-center gap-1">
                <span className="truncate">{value}</span>
                {onClear && (
                  <span
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-muted-foreground/20 shrink-0"
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    role="button"
                    data-testid={dataTestId ? `${dataTestId}-clear` : undefined}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", className)}
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: 340 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-2.5 py-1.5 gap-2">
          {step.type !== "root" && !search.trim() && (
            <button
              onClick={() => {
                if (breadcrumb.length > 0) {
                  setStep(breadcrumb[breadcrumb.length - 1].step);
                } else {
                  setStep({ type: "root" });
                }
              }}
              className="shrink-0 p-0.5 rounded hover:bg-accent"
              data-testid={dataTestId ? `${dataTestId}-back` : undefined}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Szukaj..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 border-0 p-0 text-sm focus-visible:ring-0 shadow-none"
            data-testid={dataTestId ? `${dataTestId}-search` : undefined}
          />
          {search && (
            <button onClick={() => setSearch("")} className="shrink-0 p-0.5 rounded hover:bg-accent">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {breadcrumb.length > 0 && !search.trim() && (
          <div className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-b overflow-x-auto">
            <button onClick={() => setStep({ type: "root" })} className="hover:text-foreground shrink-0">
              Start
            </button>
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={() => setStep(b.step)}
                  className="hover:text-foreground"
                >
                  {b.label}
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="overflow-y-auto max-h-[320px]">
          {renderContent()}
        </div>
      </PopoverContent>
    </Popover>
  );
}

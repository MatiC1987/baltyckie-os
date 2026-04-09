import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TargetItem {
  key: string;
  label: string;
  group: string;
  searchText?: string;
}

interface SearchableTargetSelectProps {
  items: TargetItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  clearLabel?: string;
  className?: string;
  triggerClassName?: string;
  "data-testid"?: string;
}

export function SearchableTargetSelect({
  items,
  value,
  onValueChange,
  placeholder = "Wybierz pozycję...",
  clearLabel,
  className,
  triggerClassName,
  "data-testid": dataTestId,
}: SearchableTargetSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    const item = items.find(i => i.key === value);
    return item ? item.label : "";
  }, [items, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q) ||
      (i.searchText && i.searchText.toLowerCase().includes(q))
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, TargetItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", triggerClassName)}
          data-testid={dataTestId}
        >
          <span className="truncate text-left flex-1">
            {selectedLabel || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", className)} align="start" style={{ width: "var(--radix-popover-trigger-width)", minWidth: 320 }}>
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Szukaj..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 border-0 p-0 text-sm focus-visible:ring-0 shadow-none"
            data-testid={dataTestId ? `${dataTestId}-search` : undefined}
          />
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="py-1">
            {clearLabel && !search.trim() && (
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-muted-foreground italic",
                  !value && "bg-accent"
                )}
                onClick={() => {
                  onValueChange("__clear__");
                  setOpen(false);
                  setSearch("");
                }}
                data-testid={dataTestId ? `${dataTestId}-option-clear` : undefined}
              >
                <Check className={cn("h-3 w-3 shrink-0", !value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{clearLabel}</span>
              </button>
            )}
            {Object.keys(grouped).length === 0 && !clearLabel && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Brak wyników
              </div>
            )}
            {Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {group}
                </div>
                {groupItems.map(item => (
                  <button
                    key={item.key}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                      value === item.key && "bg-accent"
                    )}
                    onClick={() => {
                      onValueChange(item.key);
                      setOpen(false);
                      setSearch("");
                    }}
                    data-testid={dataTestId ? `${dataTestId}-option-${item.key}` : undefined}
                  >
                    <Check className={cn("h-3 w-3 shrink-0", value === item.key ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

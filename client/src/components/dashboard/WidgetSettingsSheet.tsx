import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Eye, EyeOff, ChevronUp, ChevronDown as ChevronDownIcon } from "lucide-react";
import { WIDGET_REGISTRY, getDefaultPrefs, type WidgetPrefs, type WidgetDef } from "./widget-utils";

export function WidgetSettingsSheet({ open, onOpenChange, prefs, onPrefsChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: WidgetPrefs;
  onPrefsChange: (prefs: WidgetPrefs) => void;
}) {
  const categoryLabels: Record<string, string> = { financial: "Finansowe", operational: "Operacyjne", admin: "Administracyjne" };

  const toggleWidget = (id: string) => {
    const newPrefs = { ...prefs, visible: { ...prefs.visible, [id]: !prefs.visible[id] } };
    onPrefsChange(newPrefs);
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    const order = [...prefs.order];
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
    onPrefsChange({ ...prefs, order });
  };

  const resetDefaults = () => {
    onPrefsChange(getDefaultPrefs());
  };

  const orderedWidgets = prefs.order
    .map(id => WIDGET_REGISTRY.find(w => w.id === id))
    .filter((w): w is WidgetDef => !!w);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[400px] flex flex-col" data-testid="sheet-widget-settings">
        <SheetHeader>
          <SheetTitle>Konfiguracja widżetów</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-2 flex-1 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-3">Włącz/wyłącz widżety i zmień ich kolejność strzałkami.</p>
          {orderedWidgets.map((w, idx) => (
            <div key={w.id} className="flex items-center gap-1.5 py-1.5 px-2 rounded-md border border-border" data-testid={`widget-toggle-${w.id}`}>
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => moveWidget(w.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                  data-testid={`widget-move-up-${w.id}`}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveWidget(w.id, "down")}
                  disabled={idx === orderedWidgets.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                  data-testid={`widget-move-down-${w.id}`}
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  {w.label}
                  <Badge variant="outline" className="text-[9px]">{categoryLabels[w.category]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{w.description}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleWidget(w.id)}
                className={`shrink-0 toggle-elevate ${prefs.visible[w.id] ? "toggle-elevated" : ""}`}
                data-testid={`button-toggle-widget-${w.id}`}
              >
                {prefs.visible[w.id] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={resetDefaults} className="w-full mt-4" data-testid="button-reset-widget-defaults">
            Przywróć domyślne
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ActivityLog } from "@shared/schema";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Pencil, Trash2, FileText, Upload, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  create: { label: "Dodano", variant: "default", icon: Plus },
  update: { label: "Edytowano", variant: "secondary", icon: Pencil },
  delete: { label: "Usunięto", variant: "destructive", icon: Trash2 },
  import: { label: "Import", variant: "outline", icon: Upload },
  sync: { label: "Synchronizacja", variant: "outline", icon: RefreshCw },
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: "Rezerwacja",
  expense: "Koszt",
  sublease: "Podnajem",
  apartment: "Apartament",
  lease: "Umowa najmu",
  employee: "Pracownik",
  payment: "Płatność",
};

const ENTITY_OPTIONS = [
  { value: "", label: "Wszystkie" },
  { value: "reservation", label: "Rezerwacja" },
  { value: "expense", label: "Koszt" },
  { value: "sublease", label: "Podnajem" },
  { value: "apartment", label: "Apartament" },
  { value: "lease", label: "Umowa najmu" },
  { value: "employee", label: "Pracownik" },
  { value: "payment", label: "Płatność" },
];

const ACTION_OPTIONS = [
  { value: "", label: "Wszystkie" },
  { value: "create", label: "Dodano" },
  { value: "update", label: "Edytowano" },
  { value: "delete", label: "Usunięto" },
  { value: "import", label: "Import" },
];

interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
}

export default function ActivityLogPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const queryParams = new URLSearchParams();
  if (entityTypeFilter) queryParams.append("entityType", entityTypeFilter);
  if (actionFilter) queryParams.append("action", actionFilter);
  queryParams.append("limit", limit.toString());
  queryParams.append("offset", offset.toString());

  const { data: response, isLoading } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/activity-logs", entityTypeFilter, actionFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
  });

  const logs = response?.logs || [];
  const total = response?.total || 0;
  const hasMore = offset + limit < total;

  if (isLoading && logs.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Historia zmian</h1>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const handleResetFilters = () => {
    setEntityTypeFilter("");
    setActionFilter("");
    setOffset(0);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Historia zmian</h1>
        <p className="text-muted-foreground text-sm">Log aktywności i zmian w systemie.</p>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="entity-type-filter" className="text-sm font-medium mb-2 block">
                Typ encji
              </label>
              <Select value={entityTypeFilter} onValueChange={(value) => {
                setEntityTypeFilter(value);
                setOffset(0);
              }}>
                <SelectTrigger id="entity-type-filter" data-testid="select-entity-type-filter">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-0">
              <label htmlFor="action-filter" className="text-sm font-medium mb-2 block">
                Akcja
              </label>
              <Select value={actionFilter} onValueChange={(value) => {
                setActionFilter(value);
                setOffset(0);
              }}>
                <SelectTrigger id="action-filter" data-testid="select-action-filter">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(entityTypeFilter || actionFilter) && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                data-testid="button-reset-filters"
              >
                Wyczyść filtry
              </Button>
            )}
          </div>

          {total > 0 && (
            <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <span>Wyniki:</span>
              <Badge variant="secondary" data-testid="badge-results-count">
                {total}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Brak zarejestrowanych zmian.</p>
            <p className="text-muted-foreground text-sm mt-1">Historia będzie zapisywana automatycznie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: "outline" as const, icon: FileText };
            const ActionIcon = actionInfo.icon;
            const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
            return (
              <Card key={log.id} data-testid={`card-activity-${log.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <ActionIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={actionInfo.variant} className="no-default-hover-elevate no-default-active-elevate text-[10px]">
                          {actionInfo.label}
                        </Badge>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-[10px]">
                          {entityLabel}
                        </Badge>
                        {log.entityName && (
                          <span className="text-sm text-muted-foreground truncate">— {log.entityName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {log.createdAt ? format(new Date(log.createdAt), "d MMM yyyy, HH:mm", { locale: pl }) : "—"}
                        {log.userName && (
                          <span>przez <span className="font-medium">{log.userName}</span></span>
                        )}
                        {log.details && (
                          <span className="ml-2 truncate">{log.details}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => setOffset(offset + limit)}
                disabled={isLoading}
                data-testid="button-load-more"
              >
                {isLoading ? "Ładowanie..." : "Załaduj więcej"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

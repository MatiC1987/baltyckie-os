import { useQuery } from "@tanstack/react-query";
import type { ActivityLog } from "@shared/schema";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Pencil, Trash2, FileText, Upload, RefreshCw } from "lucide-react";

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

export default function ActivityLogPage() {
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  if (isLoading) {
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Historia zmian</h1>
        <p className="text-muted-foreground text-sm">Log aktywności i zmian w systemie.</p>
      </div>

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
                        <span className="text-sm font-medium">{entityLabel}</span>
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
        </div>
      )}
    </div>
  );
}

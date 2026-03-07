import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, Pencil, PlusCircle, Download, Plane, Home, Receipt, FileText, Banknote,
  Trash2 as Trash2Icon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

const ACTION_LABELS: Record<string, string> = {
  create: "utworzył/a",
  update: "zaktualizował/a",
  delete: "usunął/ęła",
  import: "zaimportował/a",
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: "rezerwację",
  apartment: "apartament",
  sublease: "podnajem",
  invoice: "fakturę",
  cost: "koszt",
  lease: "umowę najmu",
  cost_invoice: "fakturę kosztową",
  payment: "płatność",
  employee: "pracownika",
  task: "zadanie",
  owner_contract: "umowę właściciela",
  owner_payment: "płatność właściciela",
  saldo: "saldo",
  bank_account: "konto bankowe",
};

function getActionIcon(action: string) {
  switch (action) {
    case "create": return <PlusCircle className="h-4 w-4 text-emerald-500" />;
    case "update": return <Pencil className="h-4 w-4 text-blue-500" />;
    case "delete": return <Trash2Icon className="h-4 w-4 text-red-500" />;
    case "import": return <Download className="h-4 w-4 text-purple-500" />;
    default: return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "reservation": return <Plane className="h-3.5 w-3.5 text-muted-foreground" />;
    case "apartment": return <Home className="h-3.5 w-3.5 text-muted-foreground" />;
    case "invoice":
    case "cost_invoice": return <Receipt className="h-3.5 w-3.5 text-muted-foreground" />;
    case "sublease":
    case "lease":
    case "owner_contract": return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
    case "cost":
    case "payment":
    case "owner_payment": return <Banknote className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

type ActivityLog = { id: number; userId?: string; userName?: string; action: string; entityType: string; entityId?: string; entityName?: string; details?: string; createdAt: string };

export function RecentActivityWidget() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ["/api/activity-logs", { limit: 10 }],
    queryFn: async () => {
      const res = await fetch("/api/activity-logs?limit=10");
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const logs = data?.logs || [];

  if (isLoading) {
    return (
      <Card data-testid="widget-recent-activity">
        <CardContent className="py-6">
          <div className="space-y-3">
            <div className="h-5 w-44 bg-muted animate-pulse rounded" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-recent-activity">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Ostatnia aktywność
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/activity-log")} data-testid="link-activity-log">
            Zobacz wszystko →
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-activity">Brak ostatniej aktywności</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0" data-testid={`activity-entry-${log.id}`}>
                <div className="mt-0.5 flex-shrink-0">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getEntityIcon(log.entityType)}
                    <p className="text-sm leading-tight">
                      <span className="font-medium">{log.userName || "System"}</span>
                      {" "}
                      <span className="text-muted-foreground">{ACTION_LABELS[log.action] || log.action}</span>
                      {" "}
                      <span className="text-muted-foreground">{ENTITY_LABELS[log.entityType] || log.entityType}</span>
                      {log.entityName && (
                        <>
                          {" — "}
                          <span className="font-medium truncate">{log.entityName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: pl })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

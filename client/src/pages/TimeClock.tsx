import { useState, useEffect, useCallback, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { useOrientationLock } from "@/hooks/use-orientation-lock";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  LogOut,
  MapPin,
  Users,
  Coffee,
  AlertTriangle,
  Loader2,
  Play,
  Square,
  History,
  ChevronLeft,
  UserX,
  CalendarDays,
  Plus,
  Send,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Calendar,
  BarChart3,
  TreePalm,
  Timer,
  Briefcase,
  Download,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";
import type { Employee, TimeEntry, LeaveRequest } from "@shared/schema";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

let rcpToken: string | null = null;

async function rcpFetch(method: string, url: string, data?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (rcpToken) headers["Authorization"] = `Bearer ${rcpToken}`;
  if (data) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Błąd serwera" }));
    throw new Error(body.message || `Error ${res.status}`);
  }
  return res;
}

type Screen = "login" | "dashboard";

interface TeamStatus {
  working: number;
  onBreak: number;
  absent: number;
  total: number;
}

interface HistoryEntry extends TimeEntry {}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="text-5xl font-bold tracking-tight tabular-nums" data-testid="text-live-clock">
      {now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

function ShiftTimer({ clockIn, breakMinutes }: { clockIn: string; breakMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startTime = new Date(clockIn).getTime();
    const update = () => {
      const diff = Date.now() - startTime - breakMinutes * 60000;
      setElapsed(Math.max(0, diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [clockIn, breakMinutes]);
  return (
    <span className="text-lg font-semibold tabular-nums" data-testid="text-shift-timer">
      {formatDuration(elapsed)}
    </span>
  );
}

function RcpInstallBanner() {
  const { showPrompt, isIos, canInstallNative, install, dismiss } = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (!showPrompt) return null;

  if (isIos) {
    return (
      <Card className="w-full p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Zainstaluj aplikację</span>
          </div>
          <button onClick={dismiss} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" data-testid="button-dismiss-install-rcp">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={() => setShowIosSteps(!showIosSteps)}
          className="text-xs text-primary hover:underline"
          data-testid="button-ios-steps-rcp"
        >
          {showIosSteps ? "Ukryj instrukcję" : "Pokaż jak zainstalować"}
        </button>
        {showIosSteps && (
          <div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p>1. Kliknij ikonę udostępniania na dole ekranu</p>
            <p>2. Wybierz <b>Dodaj do ekranu głównego</b></p>
            <p>3. Potwierdź klikając <b>Dodaj</b></p>
          </div>
        )}
      </Card>
    );
  }

  if (canInstallNative) {
    return (
      <Card className="w-full p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Zainstaluj aplikację</span>
          </div>
          <button onClick={dismiss} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" data-testid="button-dismiss-install-rcp">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Szybki dostęp z ekranu głównego.</p>
        <Button onClick={install} size="sm" className="w-full" data-testid="button-install-rcp">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Zainstaluj
        </Button>
      </Card>
    );
  }

  return null;
}

function PinLoginScreen({ onLogin }: { onLogin: (employee: Employee, entry: TimeEntry | null) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!lockUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSeconds(remaining);
      if (remaining <= 0) {
        setLockUntil(null);
        setAttempts(0);
        setError("");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  const loginMutation = useMutation({
    mutationFn: async (pinValue: string) => {
      const res = await fetch("/api/time-clock/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Błąd" }));
        throw new Error(body.message || `Error ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (data: { employee: Employee; activeEntry: TimeEntry | null; token: string }) => {
      setAttempts(0);
      rcpToken = data.token;
      haptic('success');
      onLogin(data.employee, data.activeEntry);
    },
    onError: (err: Error) => {
      haptic('medium');
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLockUntil(Date.now() + 60000);
        setLockSeconds(60);
        setError("Zbyt wiele prób. Odczekaj 60 sekund.");
      } else {
        setError("Nieprawidłowy PIN");
      }
      setPin("");
      inputRef.current?.focus();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockUntil) return;
    if (pin.length !== 6) {
      setError("PIN musi mieć 6 cyfr");
      return;
    }
    loginMutation.mutate(pin);
  };

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    if (error) setError("");
  };

  const isLocked = lockUntil !== null && lockUntil > Date.now();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logoImg} alt="Logo" className="h-16 w-auto rounded-md" data-testid="img-logo" />
          <div className="text-center">
            <h1 className="text-xl font-bold" data-testid="text-app-title">Baltyckie</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-app-subtitle">
              Rejestrator Czasu Pracy
            </p>
          </div>
        </div>

        <Card className="w-full p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Zaloguj sie</h2>
              <p className="text-sm text-muted-foreground mt-1">Wprowadz swoj 6-cyfrowy PIN</p>
            </div>

            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              disabled={isLocked || loginMutation.isPending}
              placeholder="------"
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              maxLength={6}
              data-testid="input-pin"
            />

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm justify-center" data-testid="text-pin-error">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
                {isLocked && <span className="font-mono">({lockSeconds}s)</span>}
              </div>
            )}

            <Button
              type="submit"
              disabled={pin.length !== 6 || isLocked || loginMutation.isPending}
              className="w-full"
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Zaloguj sie"
              )}
            </Button>
          </form>
        </Card>
        <RcpInstallBanner />
      </div>
    </div>
  );
}

function GpsErrorPanel({ onRetry }: { onRetry: () => void }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="w-full space-y-2" data-testid="panel-gps-error">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span>GPS niedostępny</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="ml-auto h-7 px-2 text-xs"
          data-testid="button-gps-retry"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Spróbuj ponownie
        </Button>
      </div>
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-gps-help-toggle"
      >
        <Info className="h-3 w-3" />
        <span>Jak włączyć GPS?</span>
        {showHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showHelp && (
        <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground space-y-3" data-testid="panel-gps-help">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
              <Smartphone className="h-3.5 w-3.5" />
              iPhone (Safari):
            </div>
            <ol className="list-decimal list-inside space-y-0.5 pl-1">
              <li>Otwórz <b>Ustawienia</b> → <b>Prywatność</b> → <b>Usługi lokalizacji</b> → włącz</li>
              <li>W Safari kliknij <b>aA</b> w pasku adresu</li>
              <li>Wybierz <b>Ustawienia witryny</b></li>
              <li>Przy <b>Lokalizacja</b> ustaw <b>Zezwalaj</b></li>
              <li>Odśwież stronę i kliknij <b>Spróbuj ponownie</b></li>
            </ol>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
              <Smartphone className="h-3.5 w-3.5" />
              Android (Chrome):
            </div>
            <ol className="list-decimal list-inside space-y-0.5 pl-1">
              <li>Otwórz <b>Ustawienia</b> telefonu → <b>Lokalizacja</b> → włącz</li>
              <li>W Chrome kliknij ikonę <b>kłódki</b> obok adresu</li>
              <li>Przy <b>Lokalizacja</b> wybierz <b>Zezwalaj</b></li>
              <li>Odśwież stronę i kliknij <b>Spróbuj ponownie</b></li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeDashboard({
  employee,
  initialEntry,
  onLogout,
}: {
  employee: Employee;
  initialEntry: TimeEntry | null;
  onLogout: () => void;
}) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(initialEntry);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsTrackingActive, setGpsTrackingActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeaves, setShowLeaves] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showNewLeaveDialog, setShowNewLeaveDialog] = useState(false);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const isActive = activeEntry && (activeEntry.status === "AKTYWNA" || activeEntry.status === "WARUNKOWA" || activeEntry.status === "PRZERWA");

    if (isActive && navigator.geolocation) {
      const sendLocation = () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await rcpFetch("POST", "/api/time-clock/location-log", {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
              setGpsTrackingActive(true);
            } catch {
              setGpsTrackingActive(false);
            }
          },
          () => { setGpsTrackingActive(false); },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      };

      sendLocation();
      gpsIntervalRef.current = setInterval(sendLocation, 30 * 1000);

      return () => {
        if (gpsIntervalRef.current) {
          clearInterval(gpsIntervalRef.current);
          gpsIntervalRef.current = null;
        }
        setGpsTrackingActive(false);
      };
    } else {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      setGpsTrackingActive(false);
    }
  }, [activeEntry?.id, activeEntry?.status]);

  const teamStatusQuery = useQuery<TeamStatus>({
    queryKey: ["/api/time-clock/team-status"],
    refetchInterval: 30000,
  });

  const historyQuery = useQuery<HistoryEntry[]>({
    queryKey: ["/api/time-clock/history", String(employee.id)],
    enabled: showHistory,
    queryFn: async () => {
      const res = await rcpFetch("GET", `/api/time-clock/history/${employee.id}`);
      return await res.json();
    },
  });

  const getGps = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      setGpsStatus("loading");
      if (!navigator.geolocation) {
        setGpsStatus("error");
        reject(new Error("GPS niedostepny"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsCoords(coords);
          setGpsStatus("success");
          resolve(coords);
        },
        (err) => {
          setGpsStatus("error");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      let coords: { lat: number; lng: number } | null = null;
      try {
        coords = await getGps();
      } catch {}
      const res = await rcpFetch("POST", "/api/time-clock/clock-in", {
        lat: coords?.lat || null,
        lng: coords?.lng || null,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setActiveEntry(data.entry);
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/team-status"] });
      if (data.entry.isOutsideZone) {
        haptic('medium');
        toast({
          title: "Uwaga - poza strefa",
          description: "Zarejestrowano wejscie poza strefa lokalizacji. Wpis wymaga akceptacji.",
          variant: "destructive",
        });
      } else {
        haptic('success');
        toast({ title: "Rozpoczeto prace" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      let coords: { lat: number; lng: number } | null = null;
      try {
        coords = await getGps();
      } catch {}
      const res = await rcpFetch("POST", "/api/time-clock/clock-out", {
        lat: coords?.lat || null,
        lng: coords?.lng || null,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setActiveEntry(null);
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/team-status"] });
      haptic('success');
      toast({ title: "Zakonczono prace" });
    },
    onError: (err: Error) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const breakStartMutation = useMutation({
    mutationFn: async () => {
      const res = await rcpFetch("POST", "/api/time-clock/break-start", {});
      return await res.json();
    },
    onSuccess: (data) => {
      setActiveEntry(data.entry);
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/team-status"] });
      haptic('light');
      toast({ title: "Przerwa rozpoczeta" });
    },
    onError: (err: Error) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const breakEndMutation = useMutation({
    mutationFn: async () => {
      const res = await rcpFetch("POST", "/api/time-clock/break-end", {});
      return await res.json();
    },
    onSuccess: (data) => {
      setActiveEntry(data.entry);
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/team-status"] });
      haptic('light');
      toast({ title: "Przerwa zakonczona" });
    },
    onError: (err: Error) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const leaveRequestsQuery = useQuery<LeaveRequest[]>({
    queryKey: ["/api/time-clock/leave-requests"],
    enabled: showLeaves,
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/leave-requests");
      return await res.json();
    },
  });

  type ScheduleEntry = { id: number; date: string; startTime: string; endTime: string; shiftName?: string; shiftColor?: string };
  const scheduleQuery = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/time-clock/my-schedule"],
    enabled: showSchedule,
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/my-schedule");
      return await res.json();
    },
  });

  type MonthlySummary = {
    year: number; month: number;
    workedMinutes: number; workedHours: number;
    scheduledMinutes: number; scheduledHours: number;
    normHours: number; daysWorked: number;
    leaveBalance: { allocated: number; used: number; pending: number; remaining: number };
  };
  const summaryQuery = useQuery<MonthlySummary>({
    queryKey: ["/api/time-clock/my-summary"],
    enabled: showSummary,
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/my-summary");
      return await res.json();
    },
  });

  const createLeaveMutation = useMutation({
    mutationFn: async (data: { type: string; startDate: string; endDate: string; days: number; comment: string }) => {
      const res = await rcpFetch("POST", "/api/time-clock/leave-requests", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/leave-requests"] });
      setShowNewLeaveDialog(false);
      toast({ title: "Wniosek zostal zlozony" });
    },
    onError: (err: Error) => {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    },
  });

  const isWorking = activeEntry && (activeEntry.status === "AKTYWNA" || activeEntry.status === "WARUNKOWA");
  const isOnBreak = activeEntry?.status === "PRZERWA";
  const anyPending = clockInMutation.isPending || clockOutMutation.isPending || breakStartMutation.isPending || breakEndMutation.isPending;

  const statusLabel = isOnBreak
    ? "Na przerwie"
    : isWorking
      ? `Pracujesz od ${formatTime(new Date(activeEntry!.clockIn))}`
      : "Nie pracujesz";

  const statusColor = isOnBreak
    ? "text-yellow-600 dark:text-yellow-400"
    : isWorking
      ? "text-green-600 dark:text-green-400"
      : "text-muted-foreground";

  if (showLeaves) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setShowLeaves(false)} data-testid="button-back-from-leaves">
            <ChevronLeft />
          </Button>
          <span className="font-semibold text-sm">Moje wnioski urlopowe</span>
          <Button variant="ghost" size="icon" onClick={() => setShowNewLeaveDialog(true)} data-testid="button-new-leave">
            <Plus />
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-4">
          {leaveRequestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !leaveRequestsQuery.data?.length ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
              <p className="text-center text-muted-foreground" data-testid="text-no-leaves">Brak wnioskow urlopowych</p>
              <Button onClick={() => setShowNewLeaveDialog(true)} data-testid="button-new-leave-empty">
                <Plus className="h-4 w-4 mr-2" />
                Zloz wniosek
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leaveRequestsQuery.data.map((lr) => (
                <Card key={lr.id} className="p-4" data-testid={`card-leave-${lr.id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">{leaveTypeLabel(lr.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(lr.startDate)} - {formatDateShort(lr.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">{lr.days}d</span>
                      <LeaveStatusBadge status={lr.status} />
                    </div>
                  </div>
                  {lr.comment && (
                    <p className="text-xs text-muted-foreground mt-1">{lr.comment}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <NewLeaveDialog
          open={showNewLeaveDialog}
          onClose={() => setShowNewLeaveDialog(false)}
          onSubmit={(data) => createLeaveMutation.mutate(data)}
          isPending={createLeaveMutation.isPending}
        />
      </div>
    );
  }

  if (showSchedule) {
    const dayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
    const schedulesByDate = (scheduleQuery.data || []).reduce<Record<string, ScheduleEntry[]>>((acc, s) => {
      (acc[s.date] = acc[s.date] || []).push(s);
      return acc;
    }, {});
    const sortedDates = Object.keys(schedulesByDate).sort();
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setShowSchedule(false)} data-testid="button-back-from-schedule">
            <ChevronLeft />
          </Button>
          <span className="font-semibold text-sm">Mój grafik (14 dni)</span>
          <div className="w-9" />
        </header>
        <div className="flex-1 overflow-auto p-4">
          {scheduleQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Calendar className="h-10 w-10 text-muted-foreground" />
              <p className="text-center text-muted-foreground" data-testid="text-no-schedule">Brak zaplanowanych zmian</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              {sortedDates.map((date) => {
                const d = new Date(date + "T12:00:00");
                const dayName = dayNames[d.getDay()];
                const isToday = date === new Date().toISOString().split("T")[0];
                return (
                  <Card key={date} className={`p-4 ${isToday ? "ring-2 ring-primary" : ""}`} data-testid={`card-schedule-${date}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{dayName}</span>
                        <span className="text-sm text-muted-foreground">{formatDateShort(date)}</span>
                        {isToday && <Badge variant="outline" className="text-xs bg-primary/10 text-primary">Dziś</Badge>}
                      </div>
                    </div>
                    {schedulesByDate[date].map((shift) => (
                      <div key={shift.id} className="flex items-center gap-3 py-1">
                        {shift.shiftColor && (
                          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.shiftColor }} />
                        )}
                        <span className="text-sm font-medium">{shift.startTime} - {shift.endTime}</span>
                        {shift.shiftName && (
                          <span className="text-xs text-muted-foreground">{shift.shiftName}</span>
                        )}
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showSummary) {
    const s = summaryQuery.data;
    const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    const progressPct = s ? Math.min(100, Math.round((s.workedHours / s.normHours) * 100)) : 0;
    const progressColor = progressPct >= 100 ? "bg-red-500" : progressPct >= 80 ? "bg-yellow-500" : "bg-green-500";
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setShowSummary(false)} data-testid="button-back-from-summary">
            <ChevronLeft />
          </Button>
          <span className="font-semibold text-sm">Podsumowanie miesiąca</span>
          <div className="w-9" />
        </header>
        <div className="flex-1 overflow-auto p-4">
          {summaryQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : s ? (
            <div className="flex flex-col gap-4 max-w-lg mx-auto">
              <p className="text-center text-sm text-muted-foreground" data-testid="text-summary-period">
                {monthNames[s.month - 1]} {s.year}
              </p>

              <Card className="p-4" data-testid="card-hours-summary">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Godziny pracy
                </h3>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Przepracowano</span>
                    <span className="font-semibold">{s.workedHours}h / {s.normHours}h</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all ${progressColor}`} style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{progressPct}% normy miesięcznej</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-bold text-primary" data-testid="text-worked-hours">{s.workedHours}</div>
                    <p className="text-xs text-muted-foreground">Przepracowano (h)</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold" data-testid="text-scheduled-hours">{s.scheduledHours}</div>
                    <p className="text-xs text-muted-foreground">Zaplanowano (h)</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold" data-testid="text-days-worked">{s.daysWorked}</div>
                    <p className="text-xs text-muted-foreground">Dni pracy</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4" data-testid="card-leave-balance">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TreePalm className="h-4 w-4" />
                  Urlop {s.year}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-leave-remaining">
                      {s.leaveBalance.remaining}
                    </div>
                    <p className="text-xs text-muted-foreground">Pozostało dni</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold" data-testid="text-leave-used">{s.leaveBalance.used}</div>
                    <p className="text-xs text-muted-foreground">Wykorzystano</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-leave-pending">
                      {s.leaveBalance.pending}
                    </div>
                    <p className="text-xs text-muted-foreground">Oczekujące</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-muted-foreground" data-testid="text-leave-allocated">
                      {s.leaveBalance.allocated}
                    </div>
                    <p className="text-xs text-muted-foreground">Przysługuje</p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Brak danych</p>
          )}
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} data-testid="button-back-from-history">
            <ChevronLeft />
          </Button>
          <span className="font-semibold text-sm">Historia (7 dni)</span>
          <div className="w-9" />
        </header>
        <div className="flex-1 overflow-auto p-4">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !historyQuery.data?.length ? (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-history">Brak wpisow</p>
          ) : (
            <div className="flex flex-col gap-3">
              {historyQuery.data.map((entry) => {
                const clockIn = new Date(entry.clockIn);
                const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
                const duration = clockOut
                  ? clockOut.getTime() - clockIn.getTime() - (entry.breakMinutes || 0) * 60000
                  : null;
                return (
                  <Card key={entry.id} className="p-4" data-testid={`card-history-${entry.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">{formatDateShort(entry.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(clockIn)} - {clockOut ? formatTime(clockOut) : "..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {duration !== null && (
                          <span className="text-sm font-semibold" data-testid={`text-duration-${entry.id}`}>
                            {formatDuration(duration)}
                          </span>
                        )}
                        <StatusBadge status={entry.status} />
                      </div>
                    </div>
                    {entry.breakMinutes && entry.breakMinutes > 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Przerwa: {entry.breakMinutes}m
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-2 p-3 border-b sticky top-0 z-50 bg-background">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-8 w-auto rounded-md" />
          <span className="font-semibold text-sm hidden sm:inline">RCP</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowSchedule(true)} data-testid="button-show-schedule" title="Mój grafik">
            <Calendar />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSummary(true)} data-testid="button-show-summary" title="Podsumowanie">
            <BarChart3 />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowLeaves(true)} data-testid="button-show-leaves" title="Urlopy">
            <CalendarDays />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} data-testid="button-show-history" title="Historia">
            <History />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <div data-testid="text-greeting">
            <h1 className="text-2xl font-bold">Czesc, {employee.firstName}!</h1>
            <p className="text-sm text-muted-foreground">{employee.position?.replace(/_/g, " ")}</p>
          </div>

          <Card className="p-4" data-testid="card-team-status">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Moj zespol dzisiaj
            </h3>
            {teamStatusQuery.isLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : teamStatusQuery.data ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-team-working">
                    {teamStatusQuery.data.working}
                  </div>
                  <p className="text-xs text-muted-foreground">W pracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-team-break">
                    {teamStatusQuery.data.onBreak}
                  </div>
                  <p className="text-xs text-muted-foreground">Na przerwie</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground" data-testid="text-team-absent">
                    {teamStatusQuery.data.absent}
                  </div>
                  <p className="text-xs text-muted-foreground">Nieobecnych</p>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-6" data-testid="card-time-clock">
            <div className="flex flex-col items-center gap-4">
              <LiveClock />

              {isWorking || isOnBreak ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <ShiftTimer
                    clockIn={String(activeEntry!.clockIn)}
                    breakMinutes={activeEntry!.breakMinutes || 0}
                  />
                </div>
              ) : null}

              <div className={`flex items-center gap-2 text-sm font-medium ${statusColor}`} data-testid="text-work-status">
                {isOnBreak && <Coffee className="h-4 w-4" />}
                {isWorking && <Play className="h-4 w-4" />}
                {!isWorking && !isOnBreak && <UserX className="h-4 w-4" />}
                {statusLabel}
              </div>

              {activeEntry?.isOutsideZone && (
                <div className="flex items-center gap-2 text-sm text-destructive" data-testid="text-outside-zone-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Poza strefa lokalizacji</span>
                </div>
              )}

              {gpsStatus === "loading" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-gps-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pobieranie lokalizacji GPS...</span>
                </div>
              )}

              {gpsStatus === "success" && gpsCoords && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-gps-success">
                  <MapPin className="h-4 w-4" />
                  <span>{gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
                </div>
              )}

              {gpsStatus === "error" && (
                <GpsErrorPanel onRetry={() => getGps().catch(() => {})} />
              )}

              {(isWorking || isOnBreak) && (
                <div className={`flex items-center gap-2 text-xs ${gpsTrackingActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} data-testid="text-gps-tracking">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{gpsTrackingActive ? 'Śledzenie GPS aktywne' : 'Śledzenie GPS nieaktywne'}</span>
                  {gpsTrackingActive && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                </div>
              )}

              <div className="flex flex-col gap-3 w-full mt-2">
                {!isWorking && !isOnBreak && (
                  <Button
                    onClick={() => clockInMutation.mutate()}
                    disabled={anyPending}
                    className="w-full min-h-14 text-lg bg-green-600 hover:bg-green-600 text-white border-green-700"
                    data-testid="button-clock-in"
                  >
                    {clockInMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        ROZPOCZNIJ PRACE
                      </>
                    )}
                  </Button>
                )}

                {(isWorking || isOnBreak) && (
                  <>
                    {isWorking && !isOnBreak && (
                      <Button
                        onClick={() => breakStartMutation.mutate()}
                        disabled={anyPending}
                        className="w-full min-h-14 text-lg bg-yellow-500 hover:bg-yellow-500 text-white border-yellow-600"
                        data-testid="button-break-start"
                      >
                        {breakStartMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Coffee className="h-5 w-5 mr-2" />
                            PRZERWA
                          </>
                        )}
                      </Button>
                    )}

                    {isOnBreak && (
                      <Button
                        onClick={() => breakEndMutation.mutate()}
                        disabled={anyPending}
                        className="w-full min-h-14 text-lg bg-green-600 hover:bg-green-600 text-white border-green-700"
                        data-testid="button-break-end"
                      >
                        {breakEndMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-5 w-5 mr-2" />
                            WZNOW PRACE
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      onClick={() => clockOutMutation.mutate()}
                      disabled={anyPending}
                      variant="destructive"
                      className="w-full min-h-14 text-lg"
                      data-testid="button-clock-out"
                    >
                      {clockOutMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Square className="h-5 w-5 mr-2" />
                          ZAKONCZ PRACE
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function leaveTypeLabel(type: string): string {
  const map: Record<string, string> = {
    URLOP_WYPOCZYNKOWY: "Urlop wypoczynkowy",
    URLOP_NA_ZADANIE: "Urlop na żądanie",
    ZWOLNIENIE_LEKARSKIE: "Zwolnienie lekarskie",
    INNY: "Inny",
  };
  return map[type] || type;
}

function LeaveStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    OCZEKUJACY: { label: "Oczekujący", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    ZAAKCEPTOWANY: { label: "Zaakceptowany", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    ODRZUCONY: { label: "Odrzucony", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  };
  const v = variants[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={v.className} data-testid={`badge-leave-status-${status}`}>
      {v.label}
    </Badge>
  );
}

function NewLeaveDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { type: string; startDate: string; endDate: string; days: number; comment: string }) => void;
  isPending: boolean;
}) {
  const [type, setType] = useState("URLOP_WYPOCZYNKOWY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");

  const calcDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const days = calcDays(startDate, endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || days <= 0) return;
    onSubmit({ type, startDate, endDate, days, comment });
  };

  const handleClose = () => {
    if (!isPending) {
      setType("URLOP_WYPOCZYNKOWY");
      setStartDate("");
      setEndDate("");
      setComment("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nowy wniosek urlopowy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-type">Rodzaj</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-leave-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URLOP_WYPOCZYNKOWY">Urlop wypoczynkowy</SelectItem>
                <SelectItem value="URLOP_NA_ZADANIE">Urlop na żądanie</SelectItem>
                <SelectItem value="ZWOLNIENIE_LEKARSKIE">Zwolnienie lekarskie</SelectItem>
                <SelectItem value="INNY">Inny</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-start">Data od</Label>
            <Input
              id="leave-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-leave-start"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-end">Data do</Label>
            <Input
              id="leave-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              data-testid="input-leave-end"
            />
          </div>
          {days > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-leave-days">
              Dni roboczych: <span className="font-semibold">{days}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-comment">Komentarz (opcjonalnie)</Label>
            <Textarea
              id="leave-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-leave-comment"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending} data-testid="button-cancel-leave">
              Anuluj
            </Button>
            <Button type="submit" disabled={!startDate || !endDate || days <= 0 || isPending} data-testid="button-submit-leave">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Zloz wniosek
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    AKTYWNA: { label: "Aktywna", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    ZAKONCZONA: { label: "Zakonczona", className: "bg-muted text-muted-foreground" },
    WARUNKOWA: { label: "Warunkowa", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    ZAAKCEPTOWANA: { label: "Zaakceptowana", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    ODRZUCONA: { label: "Odrzucona", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    PRZERWA: { label: "Przerwa", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  };
  const v = variants[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={v.className} data-testid={`badge-status-${status}`}>
      {v.label}
    </Badge>
  );
}

export default function TimeClock() {
  useOrientationLock("portrait");
  const [screen, setScreen] = useState<Screen>("login");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [initialEntry, setInitialEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    document.title = "RCP - Rejestrator Czasu Pracy | Baltyckie";
  }, []);

  const handleLogin = (emp: Employee, entry: TimeEntry | null) => {
    setEmployee(emp);
    setInitialEntry(entry);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    rcpToken = null;
    setEmployee(null);
    setInitialEntry(null);
    setScreen("login");
  };

  if (screen === "login" || !employee) {
    return <PinLoginScreen onLogin={handleLogin} />;
  }

  return (
    <EmployeeDashboard
      employee={employee}
      initialEntry={initialEntry}
      onLogout={handleLogout}
    />
  );
}

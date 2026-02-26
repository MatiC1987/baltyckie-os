import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";
import type { Employee, TimeEntry } from "@shared/schema";

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
      onLogin(data.employee, data.activeEntry);
    },
    onError: (err: Error) => {
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
      </div>
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
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

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
        toast({
          title: "Uwaga - poza strefa",
          description: "Zarejestrowano wejscie poza strefa lokalizacji. Wpis wymaga akceptacji.",
          variant: "destructive",
        });
      } else {
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
      toast({ title: "Przerwa zakonczona" });
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
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} data-testid="button-show-history">
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
                <div className="flex items-center gap-2 text-sm text-destructive" data-testid="text-gps-error">
                  <MapPin className="h-4 w-4" />
                  <span>GPS niedostepny</span>
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

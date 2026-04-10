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
  ChevronRight,
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
  Car,
  ClipboardList,
  MoreHorizontal,
  CheckCircle2,
  CircleDot,
  MessageSquare,
  Navigation,
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
  const [activeTab, setActiveTab] = useState<"today" | "tasks" | "km" | "history" | "more">("today");
  const [moreSubView, setMoreSubView] = useState<"menu" | "schedule" | "summary" | "leaves">("menu");
  const [showNewLeaveDialog, setShowNewLeaveDialog] = useState(false);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));
  const [showMileageForm, setShowMileageForm] = useState(false);
  const [mileageFrom, setMileageFrom] = useState("");
  const [mileageTo, setMileageTo] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [mileagePurpose, setMileagePurpose] = useState("");
  const showHistory = activeTab === "history";
  const showLeaves = moreSubView === "leaves" && activeTab === "more";
  const showSchedule = moreSubView === "schedule" && activeTab === "more";
  const showSummary = moreSubView === "summary" && activeTab === "more";
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const pendingBufferRef = useRef<{ latitude: number; longitude: number; accuracy: number }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    if (gpsStatus === "idle") {
      let cancelled = false;
      setGpsStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) {
            setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsStatus("success");
          }
        },
        () => {
          if (!cancelled) {
            setGpsStatus("error");
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => { cancelled = true; };
    }
  }, []);

  useEffect(() => {
    const isActive = activeEntry && (activeEntry.status === "AKTYWNA" || activeEntry.status === "WARUNKOWA" || activeEntry.status === "PRZERWA");

    if (!isActive || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsTrackingActive(false);
      return;
    }

    const sendToServer = async (lat: number, lng: number, accuracy: number) => {
      try {
        await rcpFetch("POST", "/api/time-clock/location-log", {
          latitude: lat,
          longitude: lng,
          accuracy,
        });
        setGpsTrackingActive(true);
        lastSentRef.current = Date.now();
        return true;
      } catch {
        setGpsTrackingActive(false);
        return false;
      }
    };

    const flushBuffer = async () => {
      while (pendingBufferRef.current.length > 0) {
        const entry = pendingBufferRef.current[0];
        const ok = await sendToServer(entry.latitude, entry.longitude, entry.accuracy);
        if (ok) {
          pendingBufferRef.current.shift();
        } else {
          break;
        }
      }
    };

    const MIN_INTERVAL_MS = 25000;

    const startWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          const entry = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (now - lastSentRef.current >= MIN_INTERVAL_MS) {
            sendToServer(entry.latitude, entry.longitude, entry.accuracy);
          } else {
            if (pendingBufferRef.current.length < 20) {
              pendingBufferRef.current.push(entry);
            } else {
              pendingBufferRef.current[pendingBufferRef.current.length - 1] = entry;
            }
          }
        },
        () => {
          setGpsTrackingActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );
    };

    startWatch();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        flushBuffer();
        startWatch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const flushInterval = setInterval(flushBuffer, 30000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(flushInterval);
      setGpsTrackingActive(false);
    };
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

  type TaskItem = { id: number; title: string; description: string | null; date: string; startTime: string | null; endTime: string | null; status: string; priority: string; apartmentId: number | null; actualStartTime: string | null; actualEndTime: string | null; mileageKm: string | null; notes: string | null };
  const tasksQuery = useQuery<TaskItem[]>({
    queryKey: ["/api/time-clock/my-tasks", taskDate],
    enabled: activeTab === "tasks",
    queryFn: async () => {
      const res = await rcpFetch("GET", `/api/time-clock/my-tasks?date=${taskDate}`);
      return await res.json();
    },
  });

  type MileageItem = { id: number; date: string; fromLocation: string; toLocation: string; distanceKm: string; purpose: string | null };
  const today = new Date().toISOString().slice(0, 10);
  const mileageQuery = useQuery<MileageItem[]>({
    queryKey: ["/api/time-clock/my-mileage", today],
    enabled: activeTab === "km",
    queryFn: async () => {
      const res = await rcpFetch("GET", `/api/time-clock/my-mileage?date=${today}`);
      return await res.json();
    },
  });

  const addMileageMutation = useMutation({
    mutationFn: async (data: { date: string; fromLocation: string; toLocation: string; distanceKm: string; purpose: string }) => {
      const res = await rcpFetch("POST", "/api/time-clock/mileage", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-mileage"] });
      setShowMileageForm(false);
      setMileageFrom(""); setMileageTo(""); setMileageKm(""); setMileagePurpose("");
      toast({ title: "Przejazd dodany" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status, actualStartTime, actualEndTime }: { id: number; status: string; actualStartTime?: string; actualEndTime?: string }) => {
      const res = await rcpFetch("PUT", `/api/time-clock/tasks/${id}/status`, { status, actualStartTime, actualEndTime });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-tasks"] });
      toast({ title: "Status zaktualizowany" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const dayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  const schedulesByDate = (scheduleQuery.data || []).reduce<Record<string, ScheduleEntry[]>>((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(schedulesByDate).sort();
  const sSummary = summaryQuery.data;
  const progressPct = sSummary ? Math.min(100, Math.round((sSummary.workedHours / sSummary.normHours) * 100)) : 0;
  const progressColor = progressPct >= 100 ? "bg-red-500" : progressPct >= 80 ? "bg-yellow-500" : "bg-green-500";

  const tabItems = [
    { key: "today" as const, label: "Dziś", icon: Clock },
    { key: "tasks" as const, label: "Zadania", icon: ClipboardList },
    { key: "km" as const, label: "Km", icon: Car },
    { key: "history" as const, label: "Historia", icon: History },
    { key: "more" as const, label: "Więcej", icon: MoreHorizontal },
  ];

  const totalMileageToday = (mileageQuery.data || []).reduce((sum, e) => sum + parseFloat(e.distanceKm || "0"), 0);

  const changeTaskDate = (delta: number) => {
    const d = new Date(taskDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setTaskDate(d.toISOString().slice(0, 10));
  };

  const taskStatusIcon = (status: string) => {
    if (status === "ZAKONCZONE") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "W_TRAKCIE") return <CircleDot className="h-4 w-4 text-blue-500 animate-pulse" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const renderTabContent = () => {
    if (activeTab === "today") {
      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <div data-testid="text-greeting">
            <h1 className="text-2xl font-bold">Cześć, {employee.firstName}!</h1>
            <p className="text-sm text-muted-foreground">{employee.position?.replace(/_/g, " ")}</p>
          </div>

          <Card className="p-4" data-testid="card-team-status">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Mój zespół dzisiaj
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

          <Card className="p-6 rounded-2xl" data-testid="card-time-clock">
            <div className="flex flex-col items-center gap-4">
              <LiveClock />
              {isWorking || isOnBreak ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <ShiftTimer clockIn={String(activeEntry!.clockIn)} breakMinutes={activeEntry!.breakMinutes || 0} />
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
                  <span>Poza strefą lokalizacji</span>
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
              {gpsStatus === "error" && <GpsErrorPanel onRetry={() => getGps().catch(() => {})} />}
              {(isWorking || isOnBreak) && (
                <div className={`flex items-center gap-2 text-xs ${gpsTrackingActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} data-testid="text-gps-tracking">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{gpsTrackingActive ? 'Śledzenie GPS aktywne' : 'Śledzenie GPS nieaktywne'}</span>
                  {gpsTrackingActive && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                </div>
              )}
              <div className="flex flex-col gap-3 w-full mt-2">
                {!isWorking && !isOnBreak && (
                  <Button onClick={() => clockInMutation.mutate()} disabled={anyPending} className="w-full min-h-14 text-lg rounded-2xl bg-green-600 hover:bg-green-700 text-white shadow-lg" data-testid="button-clock-in">
                    {clockInMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5 mr-2" /> ROZPOCZNIJ PRACĘ</>}
                  </Button>
                )}
                {(isWorking || isOnBreak) && (
                  <>
                    {isWorking && !isOnBreak && (
                      <Button onClick={() => breakStartMutation.mutate()} disabled={anyPending} className="w-full min-h-14 text-lg rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg" data-testid="button-break-start">
                        {breakStartMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Coffee className="h-5 w-5 mr-2" /> PRZERWA</>}
                      </Button>
                    )}
                    {isOnBreak && (
                      <Button onClick={() => breakEndMutation.mutate()} disabled={anyPending} className="w-full min-h-14 text-lg rounded-2xl bg-green-600 hover:bg-green-700 text-white shadow-lg" data-testid="button-break-end">
                        {breakEndMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5 mr-2" /> WZNÓW PRACĘ</>}
                      </Button>
                    )}
                    <Button onClick={() => clockOutMutation.mutate()} disabled={anyPending} variant="destructive" className="w-full min-h-14 text-lg rounded-2xl shadow-lg" data-testid="button-clock-out">
                      {clockOutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Square className="h-5 w-5 mr-2" /> ZAKOŃCZ PRACĘ</>}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (activeTab === "tasks") {
      const taskDateObj = new Date(taskDate + "T12:00:00");
      const taskDayName = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"][taskDateObj.getDay()];
      const isToday = taskDate === today;
      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeTaskDate(-1)} data-testid="button-task-prev-day">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <p className="font-semibold text-base" data-testid="text-task-date">{isToday ? "Dziś" : taskDayName}</p>
              <p className="text-xs text-muted-foreground">{formatDateShort(taskDate)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeTaskDate(1)} data-testid="button-task-next-day">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {tasksQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !tasksQuery.data?.length ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm" data-testid="text-no-tasks">Brak zadań na ten dzień</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasksQuery.data.map((task) => (
                <Card key={task.id} className="p-4 rounded-2xl" data-testid={`card-task-${task.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{taskStatusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.startTime && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.startTime}{task.endTime ? ` - ${task.endTime}` : ""}
                        </p>
                      )}
                      {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {task.status === "ZAPLANOWANE" && (
                      <Button size="sm" className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "W_TRAKCIE", actualStartTime: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) })} data-testid={`button-start-task-${task.id}`}>
                        <Play className="h-3 w-3 mr-1" /> Rozpocznij
                      </Button>
                    )}
                    {task.status === "W_TRAKCIE" && (
                      <Button size="sm" className="rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs" onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "ZAKONCZONE", actualEndTime: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) })} data-testid={`button-finish-task-${task.id}`}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Zakończ
                      </Button>
                    )}
                    {task.status === "ZAKONCZONE" && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-xl">Zakończone</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "km") {
      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Kilometrówka</h2>
            <Button size="sm" className="rounded-xl" onClick={() => setShowMileageForm(true)} data-testid="button-add-mileage">
              <Plus className="h-4 w-4 mr-1" /> Dodaj przejazd
            </Button>
          </div>

          <Card className="p-4 rounded-2xl bg-primary/5" data-testid="card-mileage-summary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Dziś łącznie</p>
                <p className="text-2xl font-bold">{totalMileageToday.toFixed(1)} km</p>
              </div>
              <Car className="h-8 w-8 text-primary/40" />
            </div>
          </Card>

          {mileageQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !mileageQuery.data?.length ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Navigation className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm" data-testid="text-no-mileage">Brak przejazdów dzisiaj</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {mileageQuery.data.map((entry) => (
                <Card key={entry.id} className="p-3 rounded-2xl" data-testid={`card-mileage-${entry.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{entry.fromLocation} → {entry.toLocation}</p>
                        {entry.purpose && <p className="text-xs text-muted-foreground">{entry.purpose}</p>}
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{parseFloat(entry.distanceKm).toFixed(1)} km</span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={showMileageForm} onOpenChange={setShowMileageForm}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Nowy przejazd</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addMileageMutation.mutate({ date: today, fromLocation: mileageFrom, toLocation: mileageTo, distanceKm: mileageKm, purpose: mileagePurpose }); }} className="flex flex-col gap-3">
                <div><Label>Skąd</Label><Input value={mileageFrom} onChange={(e) => setMileageFrom(e.target.value)} placeholder="np. Biuro" data-testid="input-mileage-from" /></div>
                <div><Label>Dokąd</Label><Input value={mileageTo} onChange={(e) => setMileageTo(e.target.value)} placeholder="np. Baltic 204" data-testid="input-mileage-to" /></div>
                <div><Label>Dystans (km)</Label><Input type="number" step="0.1" value={mileageKm} onChange={(e) => setMileageKm(e.target.value)} placeholder="12.5" data-testid="input-mileage-km" /></div>
                <div><Label>Cel (opcjonalnie)</Label><Input value={mileagePurpose} onChange={(e) => setMileagePurpose(e.target.value)} placeholder="np. Sprzątanie" data-testid="input-mileage-purpose" /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowMileageForm(false)}>Anuluj</Button>
                  <Button type="submit" disabled={!mileageFrom || !mileageTo || !mileageKm || addMileageMutation.isPending} data-testid="button-submit-mileage">
                    {addMileageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    if (activeTab === "history") {
      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Historia (7 dni)</h2>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !historyQuery.data?.length ? (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-history">Brak wpisów</p>
          ) : (
            <div className="flex flex-col gap-3">
              {historyQuery.data.map((entry) => {
                const clockIn = new Date(entry.clockIn);
                const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
                const duration = clockOut ? clockOut.getTime() - clockIn.getTime() - (entry.breakMinutes || 0) * 60000 : null;
                return (
                  <Card key={entry.id} className="p-4 rounded-2xl" data-testid={`card-history-${entry.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">{formatDateShort(entry.date)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(clockIn)} - {clockOut ? formatTime(clockOut) : "..."}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {duration !== null && <span className="text-sm font-semibold" data-testid={`text-duration-${entry.id}`}>{formatDuration(duration)}</span>}
                        <StatusBadge status={entry.status} />
                      </div>
                    </div>
                    {entry.breakMinutes && entry.breakMinutes > 0 ? <p className="text-xs text-muted-foreground mt-1">Przerwa: {entry.breakMinutes}m</p> : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "more") {
      if (moreSubView === "schedule") {
        return (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMoreSubView("menu")} data-testid="button-back-from-schedule"><ChevronLeft /></Button>
              <h2 className="text-lg font-bold">Mój grafik (14 dni)</h2>
            </div>
            {scheduleQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sortedDates.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12"><Calendar className="h-10 w-10 text-muted-foreground" /><p className="text-muted-foreground" data-testid="text-no-schedule">Brak zaplanowanych zmian</p></div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedDates.map((date) => {
                  const d = new Date(date + "T12:00:00");
                  const dayName = dayNames[d.getDay()];
                  const isTodayDate = date === today;
                  return (
                    <Card key={date} className={`p-4 rounded-2xl ${isTodayDate ? "ring-2 ring-primary" : ""}`} data-testid={`card-schedule-${date}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">{dayName}</span>
                        <span className="text-sm text-muted-foreground">{formatDateShort(date)}</span>
                        {isTodayDate && <Badge variant="outline" className="text-xs bg-primary/10 text-primary rounded-xl">Dziś</Badge>}
                      </div>
                      {schedulesByDate[date].map((shift) => (
                        <div key={shift.id} className="flex items-center gap-3 py-1">
                          {shift.shiftColor && <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.shiftColor }} />}
                          <span className="text-sm font-medium">{shift.startTime} - {shift.endTime}</span>
                          {shift.shiftName && <span className="text-xs text-muted-foreground">{shift.shiftName}</span>}
                        </div>
                      ))}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      if (moreSubView === "summary") {
        return (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMoreSubView("menu")} data-testid="button-back-from-summary"><ChevronLeft /></Button>
              <h2 className="text-lg font-bold">Podsumowanie miesiąca</h2>
            </div>
            {summaryQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sSummary ? (
              <div className="flex flex-col gap-4">
                <p className="text-center text-sm text-muted-foreground" data-testid="text-summary-period">{monthNames[sSummary.month - 1]} {sSummary.year}</p>
                <Card className="p-4 rounded-2xl" data-testid="card-hours-summary">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Timer className="h-4 w-4" /> Godziny pracy</h3>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1"><span>Przepracowano</span><span className="font-semibold">{sSummary.workedHours}h / {sSummary.normHours}h</span></div>
                    <div className="w-full bg-muted rounded-full h-3"><div className={`h-3 rounded-full transition-all ${progressColor}`} style={{ width: `${progressPct}%` }} /></div>
                    <p className="text-xs text-muted-foreground mt-1">{progressPct}% normy miesięcznej</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-xl font-bold text-primary" data-testid="text-worked-hours">{sSummary.workedHours}</div><p className="text-xs text-muted-foreground">Przepracowano (h)</p></div>
                    <div><div className="text-xl font-bold" data-testid="text-scheduled-hours">{sSummary.scheduledHours}</div><p className="text-xs text-muted-foreground">Zaplanowano (h)</p></div>
                    <div><div className="text-xl font-bold" data-testid="text-days-worked">{sSummary.daysWorked}</div><p className="text-xs text-muted-foreground">Dni pracy</p></div>
                  </div>
                </Card>
                <Card className="p-4 rounded-2xl" data-testid="card-leave-balance">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TreePalm className="h-4 w-4" /> Urlop {sSummary.year}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-leave-remaining">{sSummary.leaveBalance.remaining}</div><p className="text-xs text-muted-foreground">Pozostało</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold" data-testid="text-leave-used">{sSummary.leaveBalance.used}</div><p className="text-xs text-muted-foreground">Wykorzystano</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-leave-pending">{sSummary.leaveBalance.pending}</div><p className="text-xs text-muted-foreground">Oczekujące</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-muted-foreground" data-testid="text-leave-allocated">{sSummary.leaveBalance.allocated}</div><p className="text-xs text-muted-foreground">Przysługuje</p></div>
                  </div>
                </Card>
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Brak danych</p>}
          </div>
        );
      }

      if (moreSubView === "leaves") {
        return (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setMoreSubView("menu")} data-testid="button-back-from-leaves"><ChevronLeft /></Button>
                <h2 className="text-lg font-bold">Wnioski urlopowe</h2>
              </div>
              <Button size="sm" className="rounded-xl" onClick={() => setShowNewLeaveDialog(true)} data-testid="button-new-leave"><Plus className="h-4 w-4 mr-1" /> Nowy</Button>
            </div>
            {leaveRequestsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !leaveRequestsQuery.data?.length ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <CalendarDays className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-leaves">Brak wniosków urlopowych</p>
                <Button onClick={() => setShowNewLeaveDialog(true)} data-testid="button-new-leave-empty"><Plus className="h-4 w-4 mr-2" /> Złóż wniosek</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {leaveRequestsQuery.data.map((lr) => (
                  <Card key={lr.id} className="p-4 rounded-2xl" data-testid={`card-leave-${lr.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div><p className="font-medium text-sm">{leaveTypeLabel(lr.type)}</p><p className="text-xs text-muted-foreground">{formatDateShort(lr.startDate)} - {formatDateShort(lr.endDate)}</p></div>
                      <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{lr.days}d</span><LeaveStatusBadge status={lr.status} /></div>
                    </div>
                    {lr.comment && <p className="text-xs text-muted-foreground mt-1">{lr.comment}</p>}
                  </Card>
                ))}
              </div>
            )}
            <NewLeaveDialog open={showNewLeaveDialog} onClose={() => setShowNewLeaveDialog(false)} onSubmit={(data) => createLeaveMutation.mutate(data)} isPending={createLeaveMutation.isPending} />
          </div>
        );
      }

      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-3">
          <h2 className="text-lg font-bold mb-2">Więcej</h2>
          {[
            { key: "schedule" as const, label: "Mój grafik", desc: "Zaplanowane zmiany", icon: Calendar },
            { key: "summary" as const, label: "Podsumowanie", desc: "Godziny i urlopy", icon: BarChart3 },
            { key: "leaves" as const, label: "Wnioski urlopowe", desc: "Złóż lub sprawdź wniosek", icon: CalendarDays },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => setMoreSubView(item.key)} className="flex items-center gap-4 p-4 rounded-2xl bg-card border text-left hover:bg-muted/50 transition-colors w-full" data-testid={`button-more-${item.key}`}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
                <div className="flex-1"><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
          <button onClick={onLogout} className="flex items-center gap-4 p-4 rounded-2xl bg-card border text-left hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors w-full mt-4" data-testid="button-logout">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><LogOut className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
            <div className="flex-1"><p className="font-medium text-sm text-red-600 dark:text-red-400">Wyloguj się</p></div>
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-7 w-auto rounded-md" />
          <span className="font-semibold text-sm">RCP</span>
        </div>
        <div className="flex items-center gap-1">
          {(isWorking || isOnBreak) && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnBreak ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`} data-testid="badge-work-status">
              <span className={`h-1.5 w-1.5 rounded-full ${isOnBreak ? "bg-yellow-500" : "bg-green-500"} animate-pulse`} />
              {isOnBreak ? "Przerwa" : "W pracy"}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto pb-20">
        {renderTabContent()}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t safe-area-bottom" data-testid="nav-tab-bar">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); if (item.key === "more") setMoreSubView("menu"); }}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                data-testid={`tab-${item.key}`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
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

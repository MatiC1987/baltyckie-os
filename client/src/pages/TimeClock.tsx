import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";

const LazyInstrukcjaWorker = lazy(() => import("@/components/InstrukcjaWorker"));
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
  BookOpen,
  Wrench,
  Save,
  Camera,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";
import type { Employee, TimeEntry, LeaveRequest } from "@shared/schema";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

function FilePreview({ file, onRemove, testId, size = "w-16 h-16" }: { file: File; onRemove: () => void; testId?: string; size?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;
  return (
    <div className={`relative ${size} rounded-md overflow-hidden border bg-muted`}>
      <img src={url} alt={file.name} className="object-cover w-full h-full" />
      <button
        type="button"
        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
        onClick={onRemove}
        data-testid={testId}
      >×</button>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<"today" | "tasks" | "km" | "history" | "more" | "usterki">("today");
  const [moreSubView, setMoreSubView] = useState<"menu" | "schedule" | "summary" | "leaves" | "instrukcja">("menu");
  const [showNewLeaveDialog, setShowNewLeaveDialog] = useState(false);
  const nowForSchedule = new Date();
  const [scheduleYear, setScheduleYear] = useState(nowForSchedule.getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState(nowForSchedule.getMonth() + 1);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));
  const [showMileageForm, setShowMileageForm] = useState(false);
  const [mileageFrom, setMileageFrom] = useState("");
  const [mileageTo, setMileageTo] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [mileagePurpose, setMileagePurpose] = useState("");
  const showHistory = activeTab === "history";
  const isHourly = employee.cooperationType === "PRACA_NA_H";
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
        lastSentRef.current = Date.now();
        return true;
      } catch (err) {
        console.warn("[GPS] Błąd wysyłki lokalizacji na serwer:", err);
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

    // Wysyłamy GPS co 2 minuty — dobra granularność (~30 punktów/zmianę), mniejsze obciążenie serwera
    const MIN_INTERVAL_MS = 120000;

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
          setGpsTrackingActive(true);
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
    enabled: showLeaves && !isHourly,
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/leave-requests");
      return await res.json();
    },
  });

  type ScheduleEntry = { id: number; date: string; startTime: string; endTime: string; shiftName?: string; shiftColor?: string };
  const scheduleIsCurrentMonth = scheduleYear === new Date().getFullYear() && scheduleMonth === (new Date().getMonth() + 1);
  const scheduleQuery = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/time-clock/my-schedule", scheduleYear, scheduleMonth, scheduleIsCurrentMonth],
    enabled: showSchedule,
    queryFn: async () => {
      const extra = scheduleIsCurrentMonth ? "&includeNext=1" : "";
      const res = await rcpFetch("GET", `/api/time-clock/my-schedule?year=${scheduleYear}&month=${scheduleMonth}${extra}`);
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

  type TaskItem = { id: number; title: string; description: string | null; date: string; startTime: string | null; endTime: string | null; status: string; priority: string; apartmentId: number | null; actualStartTime: string | null; actualEndTime: string | null; mileageKm: string | null; notes: string | null; source?: string };
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAptId, setTaskAptId] = useState("");

  const tasksQuery = useQuery<TaskItem[]>({
    queryKey: ["/api/time-clock/my-tasks", taskDate],
    enabled: activeTab === "tasks",
    queryFn: async () => {
      const res = await rcpFetch("GET", `/api/time-clock/my-tasks?date=${taskDate}`);
      return await res.json();
    },
  });

  type AptOption = { id: number; name: string; location: string | null };
  const workerAptsQuery = useQuery<AptOption[]>({
    queryKey: ["/api/time-clock/apartments"],
    enabled: activeTab === "tasks" || activeTab === "usterki",
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/apartments");
      return await res.json();
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description: string | null; apartmentId: number | null }) => {
      const res = await rcpFetch("POST", "/api/time-clock/tasks", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-tasks"] });
      setShowTaskForm(false);
      setTaskTitle(""); setTaskDesc(""); setTaskAptId("");
      toast({ title: "Wpis dodany" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteOwnTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await rcpFetch("DELETE", `/api/time-clock/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-tasks"] });
      toast({ title: "Wpis usunięty" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
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

  type IssueClockItem = {
    id: number; apartmentId: number; apartmentName: string | null;
    title: string; description: string | null; priority: string; status: string;
    category: string; reportedBy: string; assignedTo: string | null;
    notes: string | null; cost: string | null; createdAt: string; resolvedAt: string | null;
  };
  const isKonserwator = employee.position === "KONSERWATOR" || employee.position === "OSOBA_SPRZATAJACA";
  const usterkiQuery = useQuery<IssueClockItem[]>({
    queryKey: ["/api/time-clock/my-issues"],
    enabled: activeTab === "usterki" && isKonserwator,
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/my-issues");
      return await res.json();
    },
  });
  const usterkiReportedQuery = useQuery<IssueClockItem[]>({
    queryKey: ["/api/time-clock/my-reported-issues"],
    enabled: activeTab === "usterki",
    queryFn: async () => {
      const res = await rcpFetch("GET", "/api/time-clock/my-reported-issues");
      return await res.json();
    },
  });
  const [showNewIssueDialog, setShowNewIssueDialog] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [newIssuePriority, setNewIssuePriority] = useState("NORMALNY");
  const [newIssueApartmentId, setNewIssueApartmentId] = useState("");
  const [newIssueCategory, setNewIssueCategory] = useState("ogólne");
  const [newIssueFiles, setNewIssueFiles] = useState<File[]>([]);
  const newIssueFileRef = useRef<HTMLInputElement>(null);
  const reportIssueMutation = useMutation({
    mutationFn: async () => {
      const uploadedUrls: string[] = [];
      if (newIssueFiles.length > 0) {
        const authHeaders: Record<string, string> = {};
        if (rcpToken) authHeaders["Authorization"] = `Bearer ${rcpToken}`;
        for (const file of newIssueFiles) {
          const formData = new FormData();
          formData.append("photo", file);
          const uploadRes = await fetch("/api/time-clock/issues/upload-photo", {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });
          if (!uploadRes.ok) {
            const errBody = await uploadRes.json().catch(() => ({ message: "Błąd uploadu zdjęć" }));
            throw new Error(errBody.message || "Błąd uploadu zdjęć");
          }
          const { url } = await uploadRes.json();
          uploadedUrls.push(url);
        }
      }
      const res = await rcpFetch("POST", "/api/time-clock/issues", {
        apartmentId: Number(newIssueApartmentId),
        title: newIssueTitle.trim(),
        description: newIssueDesc.trim() || null,
        priority: newIssuePriority,
        category: newIssueCategory,
        photoUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-reported-issues"] });
      setShowNewIssueDialog(false);
      setNewIssueTitle(""); setNewIssueDesc(""); setNewIssuePriority("NORMALNY"); setNewIssueApartmentId(""); setNewIssueCategory("ogólne"); setNewIssueFiles([]);
      toast({ title: "Usterka zgłoszona" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const updateIssueStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await rcpFetch("PUT", `/api/time-clock/issues/${id}/status`, { status, notes });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-clock/my-issues"] });
      toast({ title: "Status zaktualizowany" });
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
    { key: "usterki" as const, label: "Usterki", icon: Wrench },
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

          {isToday && (
            <Button size="sm" className="rounded-xl self-end" onClick={() => setShowTaskForm(true)} data-testid="button-add-own-task">
              <Plus className="h-4 w-4 mr-1" /> Dodaj wpis
            </Button>
          )}

          {tasksQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !tasksQuery.data?.length ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm" data-testid="text-no-tasks">Brak zadań na ten dzień</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasksQuery.data.map((task) => {
                const isOwnEntry = task.source === "PRACOWNIK";
                return (
                  <Card key={task.id} className="p-4 rounded-2xl" data-testid={`card-task-${task.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{taskStatusIcon(task.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          {isOwnEntry && (
                            <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shrink-0" data-testid={`badge-own-task-${task.id}`}>Własne</Badge>
                          )}
                        </div>
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
                      {isOwnEntry && (
                        <Button size="sm" variant="ghost" className="rounded-xl text-xs text-destructive hover:text-destructive ml-auto" onClick={() => { if (window.confirm("Usunąć wpis?")) deleteOwnTaskMutation.mutate(task.id); }} data-testid={`button-delete-own-task-${task.id}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={showTaskForm} onOpenChange={(v) => { if (!v) { setShowTaskForm(false); setTaskTitle(""); setTaskDesc(""); setTaskAptId(""); } }}>
            <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Dodaj wpis</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!taskTitle.trim()) return; addTaskMutation.mutate({ title: taskTitle.trim(), description: taskDesc.trim() || null, apartmentId: taskAptId && taskAptId !== "none" ? Number(taskAptId) : null }); }} className="flex flex-col gap-3">
                <div><Label>Co robiłeś/aś?</Label><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="np. Wymiana żarówki w 305" data-testid="input-own-task-title" /></div>
                <div><Label>Opis (opcjonalnie)</Label><Textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="resize-none" rows={2} data-testid="input-own-task-desc" /></div>
                <div>
                  <Label>Apartament (opcjonalnie)</Label>
                  <Select value={taskAptId} onValueChange={setTaskAptId}>
                    <SelectTrigger data-testid="select-own-task-apartment"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Brak —</SelectItem>
                      {(workerAptsQuery.data || []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setShowTaskForm(false); setTaskTitle(""); setTaskDesc(""); setTaskAptId(""); }}>Anuluj</Button>
                  <Button type="submit" disabled={!taskTitle.trim() || addTaskMutation.isPending} data-testid="button-submit-own-task">
                    {addTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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

          <div className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2.5" data-testid="banner-km-info">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">Kilometrówka rejestruje tylko przejazdy z bieżącego dnia. Wcześniejszych wpisów nie można dodać.</p>
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
          <h2 className="text-lg font-bold">Historia (14 dni)</h2>
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

    if (activeTab === "usterki") {
      const assignedList = usterkiQuery.data || [];
      const reportedList = usterkiReportedQuery.data || [];
      const PRIORITY_COLORS: Record<string, string> = {
        PILNY: "bg-red-500/15 text-red-600 border-red-500/20",
        WYSOKI: "bg-orange-500/15 text-orange-600 border-orange-500/20",
        NORMALNY: "bg-blue-500/15 text-blue-600 border-blue-500/20",
        NISKI: "bg-gray-500/15 text-gray-600 border-gray-500/20",
      };
      const PRIORITY_LABELS: Record<string, string> = { PILNY: "Pilny", WYSOKI: "Wysoki", NORMALNY: "Normalny", NISKI: "Niski" };
      const STATUS_LABELS: Record<string, string> = { OTWARTE: "Otwarte", W_REALIZACJI: "W realizacji", "ROZWIĄZANE": "Rozwiązane", "ZAMKNIĘTE": "Zamknięte" };
      const STATUS_COLORS: Record<string, string> = {
        OTWARTE: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20",
        W_REALIZACJI: "bg-blue-500/15 text-blue-600 border-blue-500/20",
        "ROZWIĄZANE": "bg-green-500/15 text-green-600 border-green-500/20",
        "ZAMKNIĘTE": "bg-gray-500/15 text-gray-600 border-gray-500/20",
      };
      const apts = workerAptsQuery.data || [];
      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Usterki</h2>
              {(usterkiReportedQuery.isLoading || usterkiQuery.isLoading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <Button size="sm" className="rounded-xl" onClick={() => setShowNewIssueDialog(true)} data-testid="button-new-issue">
              <Plus className="h-4 w-4 mr-1" /> Zgłoś
            </Button>
          </div>

          {isKonserwator && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Przypisane do mnie</h3>
              {!usterkiQuery.isLoading && assignedList.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-assigned-usterki">Brak przypisanych usterek</p>
              )}
              {assignedList.map(issue => (
                <UsterkiCard
                  key={issue.id}
                  issue={issue}
                  priorityColors={PRIORITY_COLORS}
                  priorityLabels={PRIORITY_LABELS}
                  statusLabels={STATUS_LABELS}
                  onUpdateStatus={(id, status, notes) => updateIssueStatusMutation.mutate({ id, status, notes })}
                  isPending={updateIssueStatusMutation.isPending}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Moje zgłoszenia</h3>
            {!usterkiReportedQuery.isLoading && reportedList.length === 0 && (
              <Card className="p-6 text-center" data-testid="text-no-usterki">
                <Wrench className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Nie masz jeszcze żadnych zgłoszeń</p>
              </Card>
            )}
            <div className="flex flex-col gap-2">
              {reportedList.map(issue => (
                <Card key={issue.id} className="p-3 rounded-2xl" data-testid={`card-reported-issue-${issue.id}`}>
                  <p className="font-medium text-sm" data-testid={`text-reported-issue-title-${issue.id}`}>{issue.title}</p>
                  <p className="text-xs text-muted-foreground">{issue.apartmentName || ""}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[issue.priority] || ""}`}>{PRIORITY_LABELS[issue.priority] || issue.priority}</Badge>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[issue.status] || ""}`}>{STATUS_LABELS[issue.status] || issue.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Dialog open={showNewIssueDialog} onOpenChange={v => { setShowNewIssueDialog(v); if (!v) setNewIssueFiles([]); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Zgłoś usterkę</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Apartament</Label>
                  <Select value={newIssueApartmentId} onValueChange={setNewIssueApartmentId}>
                    <SelectTrigger data-testid="select-new-issue-apartment">
                      <SelectValue placeholder="Wybierz apartament" />
                    </SelectTrigger>
                    <SelectContent>
                      {apts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tytuł</Label>
                  <Input
                    value={newIssueTitle}
                    onChange={e => setNewIssueTitle(e.target.value)}
                    placeholder="Np. Zepsuty kran w łazience"
                    data-testid="input-new-issue-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Opis (opcjonalnie)</Label>
                  <Textarea
                    value={newIssueDesc}
                    onChange={e => setNewIssueDesc(e.target.value)}
                    placeholder="Szczegóły..."
                    className="resize-none"
                    rows={2}
                    data-testid="input-new-issue-desc"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Priorytet</Label>
                    <Select value={newIssuePriority} onValueChange={setNewIssuePriority}>
                      <SelectTrigger data-testid="select-new-issue-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NISKI">Niski</SelectItem>
                        <SelectItem value="NORMALNY">Normalny</SelectItem>
                        <SelectItem value="WYSOKI">Wysoki</SelectItem>
                        <SelectItem value="PILNY">Pilny</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label>Kategoria</Label>
                    <Select value={newIssueCategory} onValueChange={setNewIssueCategory}>
                      <SelectTrigger data-testid="select-new-issue-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hydraulika">Hydraulika</SelectItem>
                        <SelectItem value="elektryka">Elektryka</SelectItem>
                        <SelectItem value="AGD">AGD</SelectItem>
                        <SelectItem value="meble">Meble</SelectItem>
                        <SelectItem value="ogólne">Ogólne</SelectItem>
                        <SelectItem value="inne">Inne</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Zdjęcia (max 3)</Label>
                  {newIssueFiles.length < 3 && (
                    <div
                      className="border-2 border-dashed rounded-md p-3 text-center cursor-pointer hover:border-primary transition-colors"
                      onClick={() => newIssueFileRef.current?.click()}
                      data-testid="dropzone-new-issue-photos"
                    >
                      <Camera className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Dodaj zdjęcia</p>
                      <input
                        ref={newIssueFileRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={e => {
                          if (e.target.files) {
                            const added = Array.from(e.target.files);
                            setNewIssueFiles(prev => [...prev, ...added].slice(0, 3));
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  )}
                  {newIssueFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {newIssueFiles.map((f, i) => (
                        <FilePreview
                          key={i}
                          file={f}
                          onRemove={() => setNewIssueFiles(prev => prev.filter((_, idx) => idx !== i))}
                          testId={`button-remove-new-issue-photo-${i}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={!newIssueTitle.trim() || !newIssueApartmentId || reportIssueMutation.isPending}
                  onClick={() => reportIssueMutation.mutate()}
                  data-testid="button-submit-new-issue"
                >
                  {reportIssueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Zgłoś usterkę
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    if (activeTab === "more") {
      if (moreSubView === "schedule") {
        const isCurrentMonth = scheduleIsCurrentMonth;

        const prevScheduleMonth = () => {
          if (scheduleMonth === 1) { setScheduleYear(y => y - 1); setScheduleMonth(12); }
          else setScheduleMonth(m => m - 1);
        };
        const nextScheduleMonth = () => {
          if (scheduleMonth === 12) { setScheduleYear(y => y + 1); setScheduleMonth(1); }
          else setScheduleMonth(m => m + 1);
        };

        const schedMonthHours = (scheduleQuery.data || []).reduce((sum, s) => {
          if (s.startTime && s.endTime) {
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            let diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff < 0) diff += 24 * 60;
            return sum + diff / 60;
          }
          return sum;
        }, 0);
        const NORM_HOURS = 168;
        const schedPct = isHourly ? 0 : Math.min(100, Math.round((schedMonthHours / NORM_HOURS) * 100));
        const schedPctColor = schedPct >= 100 ? "bg-green-500" : schedPct >= 60 ? "bg-blue-500" : "bg-muted-foreground/40";
        const schedDays = new Set((scheduleQuery.data || []).map(s => s.date)).size;
        const overtimeHours = !isHourly && !isCurrentMonth && schedMonthHours > NORM_HOURS
          ? +(schedMonthHours - NORM_HOURS).toFixed(1) : 0;
        const nextMonthName = monthNames[scheduleMonth % 12];
        const nextMonthYear = scheduleMonth === 12 ? scheduleYear + 1 : scheduleYear;

        return (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMoreSubView("menu")} data-testid="button-back-from-schedule"><ChevronLeft /></Button>
              <h2 className="text-lg font-bold flex-1">Mój grafik</h2>
              {isCurrentMonth && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 rounded-xl">Bieżący</Badge>}
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={prevScheduleMonth} data-testid="button-schedule-prev-month">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-base" data-testid="text-schedule-month">{monthNames[scheduleMonth - 1]} {scheduleYear}</span>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={nextScheduleMonth} data-testid="button-schedule-next-month">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Monthly hours summary */}
            {!scheduleQuery.isLoading && (
              <Card className="p-4 rounded-2xl bg-primary/5" data-testid="card-schedule-summary">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Zaplanowane godziny</span>
                  <span className="text-sm font-bold text-primary">{schedMonthHours.toFixed(1)}h{!isHourly && !isCurrentMonth ? ` / ${NORM_HOURS}h` : ""}</span>
                </div>
                {isCurrentMonth && (
                  <p className="text-xs text-muted-foreground mb-2">{monthNames[scheduleMonth - 1]} {scheduleYear} + {nextMonthName} {nextMonthYear}</p>
                )}
                {!isHourly && !isCurrentMonth && (
                  <div className="w-full bg-muted rounded-full h-2.5 mb-1">
                    <div className={`h-2.5 rounded-full transition-all ${schedPctColor}`} style={{ width: `${schedPct}%` }} data-testid="progress-schedule-hours" />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>{schedDays} {schedDays === 1 ? "dzień" : "dni"} ze zmianami</span>
                  {!isHourly && !isCurrentMonth && <span>{schedPct}% normy</span>}
                </div>
                {overtimeHours > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium" data-testid="text-schedule-overtime">
                    <span>Nadgodziny: +{overtimeHours}h</span>
                  </div>
                )}
              </Card>
            )}

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
                {!isHourly && (
                <Card className="p-4 rounded-2xl" data-testid="card-leave-balance">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TreePalm className="h-4 w-4" /> Urlop {sSummary.year}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-leave-remaining">{sSummary.leaveBalance.remaining}</div><p className="text-xs text-muted-foreground">Pozostało</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold" data-testid="text-leave-used">{sSummary.leaveBalance.used}</div><p className="text-xs text-muted-foreground">Wykorzystano</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-leave-pending">{sSummary.leaveBalance.pending}</div><p className="text-xs text-muted-foreground">Oczekujące</p></div>
                    <div className="text-center p-3 bg-muted/50 rounded-xl"><div className="text-2xl font-bold text-muted-foreground" data-testid="text-leave-allocated">{sSummary.leaveBalance.allocated}</div><p className="text-xs text-muted-foreground">Przysługuje</p></div>
                  </div>
                </Card>
                )}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Brak danych</p>}
          </div>
        );
      }

      if (moreSubView === "leaves" && !isHourly) {
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

      if (moreSubView === "instrukcja") {
        return (
          <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMoreSubView("menu")} data-testid="button-back-from-instrukcja"><ChevronLeft /></Button>
              <h2 className="text-lg font-bold">Instrukcja</h2>
            </div>
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <LazyInstrukcjaWorker cooperationType={employee.cooperationType} />
            </Suspense>
          </div>
        );
      }

      return (
        <div className="max-w-lg mx-auto p-4 flex flex-col gap-3">
          <h2 className="text-lg font-bold mb-2">Więcej</h2>
          {[
            { key: "schedule" as const, label: "Mój grafik", desc: "Zaplanowane zmiany", icon: Calendar },
            { key: "summary" as const, label: "Podsumowanie", desc: isHourly ? "Godziny pracy" : "Godziny i urlopy", icon: BarChart3 },
            ...(!isHourly ? [{ key: "leaves" as const, label: "Wnioski urlopowe", desc: "Złóż lub sprawdź wniosek", icon: CalendarDays }] : []),
            { key: "instrukcja" as const, label: "Instrukcja", desc: "Jak korzystać z aplikacji", icon: BookOpen },
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
    CH: "Chorobowe",
    OP: "Opieka nad dzieckiem",
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
                <SelectItem value="CH">Chorobowe</SelectItem>
                <SelectItem value="OP">Opieka nad dzieckiem</SelectItem>
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

type UsterkiCardProps = {
  issue: {
    id: number; title: string; description: string | null; priority: string; status: string;
    category: string; apartmentName: string | null; createdAt: string; notes: string | null;
  };
  priorityColors: Record<string, string>;
  priorityLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  onUpdateStatus: (id: number, status: string, notes?: string) => void;
  isPending: boolean;
};

function UsterkiCard({ issue, priorityColors, priorityLabels, statusLabels, onUpdateStatus, isPending }: UsterkiCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newStatus, setNewStatus] = useState(issue.status);
  const [newNotes, setNewNotes] = useState(issue.notes || "");
  const [dirty, setDirty] = useState(false);

  const STATUSES_FOR_WORKER = [
    { value: "W_REALIZACJI", label: "W realizacji" },
    { value: "ROZWIĄZANE", label: "Rozwiązane" },
  ];

  return (
    <Card className="p-4 rounded-2xl" data-testid={`card-usterka-${issue.id}`}>
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" data-testid={`text-usterka-title-${issue.id}`}>{issue.title}</p>
          <p className="text-xs text-muted-foreground">{issue.apartmentName || `Apt #${issue.id}`}</p>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className={`text-xs ${priorityColors[issue.priority] || ""}`}>{priorityLabels[issue.priority] || issue.priority}</Badge>
            <Badge variant="outline" className="text-xs">{statusLabels[issue.status] || issue.status}</Badge>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {issue.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{issue.description}</p>
          )}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Zaktualizuj status</p>
            <Select value={newStatus} onValueChange={v => { setNewStatus(v); setDirty(true); }}>
              <SelectTrigger className="h-8 text-sm" data-testid={`select-usterka-status-${issue.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES_FOR_WORKER.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Notatka</p>
            <Textarea
              value={newNotes}
              onChange={e => { setNewNotes(e.target.value); setDirty(true); }}
              rows={2}
              className="text-sm resize-none"
              placeholder="Opis wykonanych prac..."
              data-testid={`input-usterka-notes-${issue.id}`}
            />
          </div>
          {dirty && (
            <Button className="w-full" size="sm" disabled={isPending} onClick={() => onUpdateStatus(issue.id, newStatus, newNotes || undefined)} data-testid={`button-save-usterka-${issue.id}`}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Zapisz
            </Button>
          )}
        </div>
      )}
    </Card>
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

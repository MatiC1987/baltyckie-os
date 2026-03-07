import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Building2, BarChart3, Calendar, Shield, Fingerprint, Loader2, Eye, EyeOff, ClipboardList, CheckSquare, Clock, Wifi, WifiOff } from "lucide-react";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";
import { motion } from "framer-motion";
import { setAuthToken } from "@/lib/auth-token";
import { useQueryClient } from "@tanstack/react-query";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const features = [
  { icon: Building2, label: "Zarządzanie apartamentami" },
  { icon: BarChart3, label: "Analiza finansowa" },
  { icon: Calendar, label: "Rezerwacje i kalendarz" },
  { icon: Shield, label: "Bezpieczne dane" },
];

const quickAccessPanels = [
  { label: "Recepcja", href: "/recepcja", icon: ClipboardList, desc: "Panel recepcji" },
  { label: "Zadania", href: "/zadania", icon: CheckSquare, desc: "Zarządzanie zadaniami" },
  { label: "RCP", href: "/rcp", icon: Clock, desc: "Rejestracja czasu pracy" },
];

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return isOnline;
}

function useThemeLogo() {
  const [logoSrc, setLogoSrc] = useState(logoImg);
  const prevUrlRef = { current: "" };

  useEffect(() => {
    let cancelled = false;

    async function tryLoadLogo() {
      const isDark = document.documentElement.classList.contains("dark");
      const endpoint = isDark ? "/api/company-settings/logo-dark" : "/api/company-settings/logo";
      const fallbackEndpoint = "/api/company-settings/logo";
      try {
        const res = await fetch(`${endpoint}?t=${Date.now()}`);
        if (!cancelled && res.ok) {
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          prevUrlRef.current = url;
          setLogoSrc(url);
          return;
        }
        if (isDark) {
          const fallback = await fetch(`${fallbackEndpoint}?t=${Date.now()}`);
          if (!cancelled && fallback.ok) {
            if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
            const blob = await fallback.blob();
            const url = URL.createObjectURL(blob);
            prevUrlRef.current = url;
            setLogoSrc(url);
            return;
          }
        }
      } catch {}
      if (!cancelled) setLogoSrc(logoImg);
    }

    tryLoadLogo();

    const observer = new MutationObserver(() => {
      tryLoadLogo();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelled = true;
      observer.disconnect();
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return logoSrc;
}

export default function Landing() {
  const themeLogo = useThemeLogo();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasWebauthn, setHasWebauthn] = useState(false);
  const [checkingWebauthn, setCheckingWebauthn] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registeringBiometric, setRegisteringBiometric] = useState(false);

  const checkWebauthn = useCallback(async (emailValue: string) => {
    if (!emailValue || !emailValue.includes("@")) {
      setHasWebauthn(false);
      return;
    }
    setCheckingWebauthn(true);
    try {
      const res = await fetch(`/api/webauthn/has-credentials?email=${encodeURIComponent(emailValue)}`);
      if (res.ok) {
        const data = await res.json();
        setHasWebauthn(data.has);
      }
    } catch {
      setHasWebauthn(false);
    } finally {
      setCheckingWebauthn(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkWebauthn(email);
    }, 500);
    return () => clearTimeout(timer);
  }, [email, checkWebauthn]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Błąd logowania");
        return;
      }

      setAuthToken(data.token);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      if (!data.hasWebauthn) {
        setShowRegisterDialog(true);
      }
    } catch (err) {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setError("");
    setBiometricLoading(true);

    try {
      const optionsRes = await fetch("/api/webauthn/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        setError(err.message || "Błąd logowania biometrycznego");
        return;
      }

      const options = await optionsRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: authResponse }),
        credentials: "include",
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.message || "Weryfikacja biometryczna nie powiodła się");
        return;
      }

      setAuthToken(verifyData.token);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setError("Anulowano logowanie biometryczne");
      } else {
        setError("Błąd logowania biometrycznego");
      }
    } finally {
      setBiometricLoading(false);
    }
  }

  async function handleRegisterBiometric() {
    setRegisteringBiometric(true);
    try {
      const token = localStorage.getItem("bf_auth_token");
      const optionsRes = await fetch("/api/webauthn/register/options", {
        method: "POST",
        headers: { "x-auth-token": token || "" },
        credentials: "include",
      });

      if (!optionsRes.ok) {
        toast({ title: "Błąd", description: "Nie udało się rozpocząć rejestracji", variant: "destructive" });
        return;
      }

      const options = await optionsRes.json();
      const regResponse = await startRegistration({ optionsJSON: options });

      const deviceName = navigator.userAgent.includes("iPhone") ? "iPhone" :
        navigator.userAgent.includes("iPad") ? "iPad" :
        navigator.userAgent.includes("Android") ? "Android" :
        navigator.userAgent.includes("Mac") ? "Mac" :
        navigator.userAgent.includes("Windows") ? "Windows" : "Urządzenie";

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
        },
        body: JSON.stringify({ credential: regResponse, deviceName }),
        credentials: "include",
      });

      if (verifyRes.ok) {
        toast({ title: "Urządzenie zarejestrowane", description: "Następnym razem możesz logować się biometrycznie" });
        setShowRegisterDialog(false);
      } else {
        toast({ title: "Błąd", description: "Rejestracja nie powiodła się", variant: "destructive" });
      }
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Anulowano", description: "Rejestracja biometryczna została anulowana" });
      } else {
        toast({ title: "Błąd", description: "Rejestracja nie powiodła się", variant: "destructive" });
      }
    } finally {
      setRegisteringBiometric(false);
    }
  }

  function skipBiometricRegistration() {
    setShowRegisterDialog(false);
  }

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row" data-testid="landing-page">
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative flex-1 flex flex-col items-center justify-center p-8 lg:p-16 overflow-hidden bg-gradient-to-br from-[#051F51] via-[#0a3a7a] to-[#5ADBFA] dark:from-[#020d22] dark:via-[#051F51] dark:to-[#0a3a7a]"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full bg-white/5 blur-2xl"
          />
          <motion.div
            animate={{ y: [0, 15, 0], x: [0, -12, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[20%] right-[10%] w-80 h-80 rounded-full bg-[#5ADBFA]/10 blur-3xl"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-[50%] right-[30%] w-40 h-40 rounded-full bg-white/5 blur-xl"
          />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            src={themeLogo}
            alt="Bałtyckie Finanse"
            className="w-40 h-40 lg:w-52 lg:h-52 rounded-2xl shadow-2xl mb-8 object-contain bg-white/90 dark:bg-white/10 p-2"
            data-testid="img-logo"
          />
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-3xl lg:text-4xl font-bold text-white mb-3 font-display tracking-tight"
          >
            Bałtyckie Finanse
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="text-lg text-white/70 mb-10"
          >
            Zarządzanie finansami wynajmu
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="grid grid-cols-2 gap-4 w-full"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.1 }}
                className="flex items-center gap-3 text-white/80 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3"
              >
                <f.icon className="h-5 w-5 text-[#5ADBFA] shrink-0" aria-hidden="true" />
                <span className="text-sm leading-tight">{f.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-background"
      >
        <div className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="rounded-2xl border border-border bg-card p-8 shadow-xl dark:bg-card/80 dark:backdrop-blur-xl dark:border-white/10 dark:shadow-2xl"
            data-testid="login-card"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Witamy ponownie</h2>
              <p className="text-muted-foreground text-sm">
                Zaloguj się, aby zarządzać swoimi finansami
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="twoj@email.pl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-login-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Hasło</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Wprowadź hasło"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-2"
                  data-testid="text-login-error"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading || !email || !password}
                className="w-full text-base bg-[#051F51] text-white shadow-lg hover:bg-[#0a2d6b]"
                data-testid="button-login"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                Zaloguj się
              </Button>

              {hasWebauthn && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={biometricLoading}
                  onClick={handleBiometricLogin}
                  className="w-full text-base"
                  data-testid="button-biometric-login"
                >
                  {biometricLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Fingerprint className="mr-2 h-5 w-5" />
                  )}
                  Zaloguj biometrycznie
                </Button>
              )}
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Logowanie zabezpieczone szyfrowaniem
            </p>
          </motion.div>
        </div>
      </motion.div>

      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              Logowanie biometryczne
            </DialogTitle>
            <DialogDescription>
              Chcesz logować się szybciej? Zarejestruj odcisk palca, Face ID lub klucz bezpieczeństwa, aby następnym razem logować się jednym dotknięciem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleRegisterBiometric}
              disabled={registeringBiometric}
              className="w-full"
              data-testid="button-register-biometric"
            >
              {registeringBiometric ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
              )}
              Zarejestruj urządzenie
            </Button>
            <Button
              variant="ghost"
              onClick={skipBiometricRegistration}
              className="w-full text-muted-foreground"
              data-testid="button-skip-biometric"
            >
              Może później
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

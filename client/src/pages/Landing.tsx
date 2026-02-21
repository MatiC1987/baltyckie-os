import { Button } from "@/components/ui/button";
import { LogIn, Building2, BarChart3, Calendar, Shield } from "lucide-react";
import logoImg from "@assets/base_logo_white_background_1770751806017.png";
import { motion } from "framer-motion";

const features = [
  { icon: Building2, label: "Zarządzanie apartamentami" },
  { icon: BarChart3, label: "Analiza finansowa" },
  { icon: Calendar, label: "Rezerwacje i kalendarz" },
  { icon: Shield, label: "Bezpieczne dane" },
];

export default function Landing() {
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
            src={logoImg}
            alt="Bałtyckie Finanse"
            className="w-40 h-40 lg:w-52 lg:h-52 rounded-2xl shadow-2xl mb-8 object-contain bg-white/90 p-2"
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
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Witamy ponownie</h2>
              <p className="text-muted-foreground text-sm">
                Zaloguj się, aby zarządzać swoimi finansami
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => (window.location.href = "/api/login")}
              className="w-full text-base bg-[#051F51] text-white shadow-lg"
              data-testid="button-login"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Zaloguj się przez Replit
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Logowanie zabezpieczone przez Replit Auth
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

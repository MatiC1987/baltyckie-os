import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { Button } from "@/components/ui/button";
import { Download, X, Share, Plus } from "lucide-react";
import { useState } from "react";

export function InstallPrompt({ variant = "sidebar" }: { variant?: "sidebar" | "compact" }) {
  const { showPrompt, isIos, canInstallNative, install, dismiss } = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (!showPrompt) return null;

  if (variant === "compact") {
    return (
      <div className="px-2 py-1.5">
        {isIos ? (
          <div>
            <button
              onClick={() => setShowIosSteps(!showIosSteps)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#5ADBFA] bg-[#5ADBFA]/10 transition-colors hover:bg-[#5ADBFA]/15"
              data-testid="button-install-prompt-compact"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>Zainstaluj</span>
            </button>
            {showIosSteps && (
              <div className="mt-2 mx-1 p-3 rounded-lg bg-slate-800 text-[11px] text-slate-300 space-y-2">
                <p className="font-medium text-white text-xs">Dodaj do ekranu:</p>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">1</span>
                  <span>Kliknij <Share className="inline h-3 w-3 text-[#5ADBFA]" /> na dole ekranu</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">2</span>
                  <span>Przewiń i wybierz <b className="text-white">Dodaj do ekranu</b> <Plus className="inline h-3 w-3 text-[#5ADBFA]" /></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">3</span>
                  <span>Potwierdź klikając <b className="text-white">Dodaj</b></span>
                </div>
                <button
                  onClick={dismiss}
                  className="w-full text-center text-[10px] text-slate-500 hover:text-slate-300 mt-1 transition-colors"
                  data-testid="button-dismiss-install-ios-compact"
                >
                  Nie pokazuj ponownie
                </button>
              </div>
            )}
          </div>
        ) : canInstallNative ? (
          <div className="flex items-center gap-1">
            <button
              onClick={install}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#5ADBFA] bg-[#5ADBFA]/10 transition-colors hover:bg-[#5ADBFA]/15"
              data-testid="button-install-native-compact"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>Zainstaluj</span>
            </button>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              data-testid="button-dismiss-install-compact"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="rounded-lg bg-[#5ADBFA]/10 border border-[#5ADBFA]/20 p-3">
        {isIos ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#5ADBFA] shrink-0" />
                <span className="text-xs font-medium text-white">Zainstaluj aplikację</span>
              </div>
              <button
                onClick={dismiss}
                className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
                data-testid="button-dismiss-install-ios"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">1</span>
                <span>Kliknij <Share className="inline h-3 w-3 text-[#5ADBFA]" /> na dole ekranu</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">2</span>
                <span>Przewiń i wybierz <b className="text-white">Dodaj do ekranu głównego</b> <Plus className="inline h-3 w-3 text-[#5ADBFA]" /></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">3</span>
                <span>Potwierdź klikając <b className="text-white">Dodaj</b></span>
              </div>
            </div>
          </div>
        ) : canInstallNative ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#5ADBFA] shrink-0" />
                <span className="text-xs font-medium text-white">Zainstaluj aplikację</span>
              </div>
              <button
                onClick={dismiss}
                className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
                data-testid="button-dismiss-install"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Dodaj do ekranu głównego dla szybkiego dostępu i pracy offline.
            </p>
            <Button
              onClick={install}
              size="sm"
              className="w-full bg-[#5ADBFA] text-slate-900 hover:bg-[#5ADBFA]/85 text-xs"
              data-testid="button-install-native"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Zainstaluj
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

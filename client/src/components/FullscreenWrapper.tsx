import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FullscreenWrapperProps {
  children: ReactNode;
  title?: string;
  toolbar?: ReactNode;
  isFullscreen: boolean;
  onExit: () => void;
}

export function FullscreenWrapper({ children, title, toolbar, isFullscreen, onExit }: FullscreenWrapperProps) {
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onExit]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col" data-testid="fullscreen-overlay">
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {title && <span className="font-semibold text-sm truncate">{title}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {toolbar}
            <Button variant="outline" size="sm" onClick={onExit} data-testid="button-exit-fullscreen">
              <Minimize2 className="h-4 w-4 mr-1" /> Zamknij
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {children}
        </div>
        <div className="shrink-0 px-4 py-1 border-t border-border bg-muted/20 text-[10px] text-muted-foreground text-center">
          Naciśnij <kbd className="px-1 py-0.5 rounded border border-border bg-background text-[10px]">Esc</kbd> aby zamknąć tryb pełnoekranowy
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function FullscreenToggleButton({ isFullscreen, onToggle }: { isFullscreen?: boolean; onToggle: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onToggle} data-testid="button-toggle-fullscreen">
      {isFullscreen ? (
        <><Minimize2 className="h-3 w-3 mr-1" /> Zamknij pełny ekran</>
      ) : (
        <><Maximize2 className="h-3 w-3 mr-1" /> Pełny ekran</>
      )}
    </Button>
  );
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggle = useCallback(() => setIsFullscreen(prev => !prev), []);
  const enter = useCallback(() => setIsFullscreen(true), []);
  const exit = useCallback(() => setIsFullscreen(false), []);
  return { isFullscreen, toggle, enter, exit };
}

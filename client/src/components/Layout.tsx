import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { PageTransition } from "./PageTransition";
import { NavigationProgress } from "./NavigationProgress";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useState, useEffect, useMemo } from "react";
import { useAppBadge } from "@/hooks/use-app-badge";

export const SIDEBAR_FONT_SIZE_KEY = "sidebarFontSize";
export const PAGE_FONT_SIZE_KEY = "pageFontSize";
const LEGACY_FONT_SIZE_KEY = "globalFontSize";

function loadFontSize(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Number(stored);
    if (key === SIDEBAR_FONT_SIZE_KEY || key === PAGE_FONT_SIZE_KEY) {
      const legacy = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
      if (legacy) return Number(legacy);
    }
  } catch {}
  return fallback;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  useAppBadge();
  const [sidebarFontSize, setSidebarFontSize] = useState(() => loadFontSize(SIDEBAR_FONT_SIZE_KEY, 14));
  const [pageFontSize, setPageFontSize] = useState(() => loadFontSize(PAGE_FONT_SIZE_KEY, 14));

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === SIDEBAR_FONT_SIZE_KEY && e.newValue) {
        setSidebarFontSize(Number(e.newValue));
      }
      if (e.key === PAGE_FONT_SIZE_KEY && e.newValue) {
        setPageFontSize(Number(e.newValue));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setSidebarFontSize(loadFontSize(SIDEBAR_FONT_SIZE_KEY, 14));
      setPageFontSize(loadFontSize(PAGE_FONT_SIZE_KEY, 14));
    };
    window.addEventListener("fontSizeChanged", handler);
    return () => window.removeEventListener("fontSizeChanged", handler);
  }, []);

  const sidebarStyle = useMemo(() => ({ "--sidebar-fs": `${sidebarFontSize}px` } as React.CSSProperties), [sidebarFontSize]);
  const mainStyle = useMemo(() => ({ "--page-fs": `${pageFontSize}px` } as React.CSSProperties), [pageFontSize]);

  return (
    <SidebarProvider>
    <div className="flex min-h-screen bg-background overflow-x-hidden max-w-[100vw]">
      <NavigationProgress />
      <Sidebar style={sidebarStyle} />
      <main className="flex-1 min-w-0 p-4 md:p-6 pt-4 pb-20 lg:pb-4 overflow-y-auto overflow-x-hidden h-screen" style={mainStyle} data-page-fs>
        <PageTransition>
          <div className="space-y-6 md:space-y-8 pb-12">
            {children}
          </div>
        </PageTransition>
      </main>
      <div className="fixed top-4 right-4 z-30 hidden lg:flex items-center gap-2">
        <NotificationBell />
        <GlobalSearch />
      </div>
      <BottomNav />
    </div>
    </SidebarProvider>
  );
}

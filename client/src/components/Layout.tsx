import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { PageTransition } from "./PageTransition";
import { Breadcrumbs } from "./Breadcrumbs";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useState, useEffect, useMemo } from "react";

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

  const mainStyle = useMemo(() => ({ fontSize: `${pageFontSize}px` }), [pageFontSize]);
  const sidebarStyle = useMemo(() => ({ fontSize: `${sidebarFontSize}px` }), [sidebarFontSize]);

  return (
    <SidebarProvider>
    <div className="flex min-h-screen bg-background">
      <Sidebar style={sidebarStyle} />
      <main className="flex-1 p-4 md:p-6 pt-20 lg:pt-4 overflow-y-auto h-screen" style={mainStyle}>
        <Breadcrumbs />
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
    </div>
    </SidebarProvider>
  );
}

import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { PageTransition } from "./PageTransition";
import { Breadcrumbs } from "./Breadcrumbs";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useState, useEffect } from "react";

const FONT_SIZE_KEY = "globalFontSize";

function loadGlobalFontSize(): number {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) return Number(stored);
  } catch {}
  return 14;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [fontSize, setGlobalFontSize] = useState(loadGlobalFontSize);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [fontSize]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === FONT_SIZE_KEY && e.newValue) {
        setGlobalFontSize(Number(e.newValue));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <SidebarProvider>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 pt-20 lg:pt-4 overflow-y-auto h-screen">
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

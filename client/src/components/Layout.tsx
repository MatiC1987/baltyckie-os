import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { PageTransition } from "./PageTransition";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 pt-20 lg:pt-4 overflow-y-auto h-screen">
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
  );
}

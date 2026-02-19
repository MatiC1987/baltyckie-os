import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "./GlobalSearch";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:pl-4 lg:pr-4 lg:pb-4 overflow-y-auto h-screen">
        <div className="space-y-8 pb-12">
          {children}
        </div>
      </main>
      <div className="fixed top-4 right-4 z-30 hidden lg:block">
        <GlobalSearch />
      </div>
    </div>
  );
}

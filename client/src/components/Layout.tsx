import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-8 lg:p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}

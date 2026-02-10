import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:pl-4 lg:pr-4 lg:pb-4 overflow-y-auto h-screen">
        <div className="space-y-8 pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}

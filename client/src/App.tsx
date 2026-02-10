import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/Dashboard";
import Apartments from "@/pages/Apartments";
import Owners from "@/pages/Owners";
import Reservations from "@/pages/Reservations";
import Arrivals from "@/pages/Arrivals";
import Leases from "@/pages/Leases";
import Finance from "@/pages/Finance";
import Import from "@/pages/Import";
import Landing from "@/pages/Landing";
import Employees from "@/pages/Employees";
import Terminarz from "@/pages/Terminarz";
import PlaceholderPage from "@/pages/Placeholder";
import { Layout } from "@/components/Layout";

function AuthenticatedRoute({ component: Component }: { component: () => JSX.Element }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AuthenticatedPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <Layout>
      <PlaceholderPage title={title} description={description} />
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <AuthenticatedRoute component={Dashboard} />} />
      <Route path="/finance-forecast" component={() => <AuthenticatedPlaceholder title="Finanse / Prognoza" description="Przegląd finansowy i prognoza przychodów." />} />
      <Route path="/calendar" component={() => <AuthenticatedRoute component={Terminarz} />} />

      <Route path="/apartments" component={() => <AuthenticatedRoute component={Apartments} />} />
      <Route path="/owners" component={() => <AuthenticatedRoute component={Owners} />} />
      <Route path="/reservations" component={() => <AuthenticatedRoute component={Reservations} />} />
      <Route path="/arrivals" component={() => <AuthenticatedRoute component={Arrivals} />} />
      <Route path="/leases" component={() => <AuthenticatedRoute component={Leases} />} />
      <Route path="/finance" component={() => <AuthenticatedRoute component={Finance} />} />

      <Route path="/income-rent" component={() => <AuthenticatedPlaceholder title="Przychody Najem" description="Przychody z najmu apartamentów." />} />
      <Route path="/income-subrent" component={() => <AuthenticatedPlaceholder title="Przychody Podnajem" description="Przychody z podnajmu apartamentów." />} />
      <Route path="/forecast" component={() => <AuthenticatedPlaceholder title="Prognoza" description="Prognoza finansowa." />} />
      <Route path="/costs-apartments" component={() => <AuthenticatedPlaceholder title="Koszty (Apartamenty)" description="Koszty związane z apartamentami." />} />
      <Route path="/costs-expenses" component={() => <AuthenticatedPlaceholder title="Koszty (Koszty)" description="Pozostałe koszty operacyjne." />} />
      <Route path="/saldo-ml" component={() => <AuthenticatedPlaceholder title="Saldo - Małgorzata Latasiewicz" description="Rozliczenie salda." />} />
      <Route path="/saldo-jg" component={() => <AuthenticatedPlaceholder title="Saldo - Jolanta Głodkowska" description="Rozliczenie salda." />} />

      <Route path="/contracts-rent" component={() => <AuthenticatedPlaceholder title="Umowy Najmu" description="Zarządzanie umowami najmu." />} />
      <Route path="/contracts-subrent" component={() => <AuthenticatedPlaceholder title="Umowy Podnajmu" description="Zarządzanie umowami podnajmu." />} />
      <Route path="/contracts-services" component={() => <AuthenticatedPlaceholder title="Umowy (usługi)" description="Umowy na usługi." />} />
      <Route path="/contracts-other" component={() => <AuthenticatedPlaceholder title="Umowy (inne)" description="Pozostałe umowy." />} />

      <Route path="/employees" component={() => <AuthenticatedRoute component={Employees} />} />

      <Route path="/import" component={() => <AuthenticatedRoute component={Import} />} />
      <Route path="/export" component={() => <AuthenticatedPlaceholder title="Eksport rezerwacji" description="Eksport danych rezerwacji do pliku." />} />
      <Route path="/user-accounts" component={() => <AuthenticatedPlaceholder title="Konta użytkowników" description="Zarządzanie kontami użytkowników systemu." />} />

      <Route component={() => <AuthenticatedRoute component={NotFound} />} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

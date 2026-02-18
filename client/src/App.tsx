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
import Lokalizacje from "@/pages/Lokalizacje";
import ServiceContracts from "@/pages/ServiceContracts";
import Subleases from "@/pages/Subleases";
import SubrentSettlement from "@/pages/SubrentSettlement";
import CostsExpenses from "@/pages/CostsExpenses";
import CostsApartments from "@/pages/CostsApartments";
import Forecast from "@/pages/Forecast";
import UserAccounts from "@/pages/UserAccounts";
import Saldo from "@/pages/Saldo";
import DocumentTemplates from "@/pages/DocumentTemplates";
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
      <Route path="/forecast" component={() => <AuthenticatedRoute component={Forecast} />} />
      <Route path="/costs-apartments" component={() => <AuthenticatedRoute component={CostsApartments} />} />
      <Route path="/costs-expenses" component={() => <AuthenticatedRoute component={CostsExpenses} />} />
      <Route path="/saldo-ml" component={() => <Layout><Saldo personName="Małgorzata Latasiewicz" /></Layout>} />
      <Route path="/saldo-jg" component={() => <Layout><Saldo personName="Jolanta Głodkowska" /></Layout>} />
      <Route path="/saldo-mc" component={() => <Layout><Saldo personName="Mateusz Cieślak" /></Layout>} />

      <Route path="/contracts-subrent" component={() => <AuthenticatedRoute component={Subleases} />} />
      <Route path="/subrent-settlement" component={() => <AuthenticatedRoute component={SubrentSettlement} />} />
      <Route path="/subrent-media" component={() => <AuthenticatedPlaceholder title="Podnajem - Rozliczenie mediów" description="Rozliczenie mediów dla podnajmów." />} />
      <Route path="/contracts-services" component={() => <AuthenticatedRoute component={ServiceContracts} />} />

      <Route path="/document-templates" component={() => <AuthenticatedRoute component={DocumentTemplates} />} />
      <Route path="/employees" component={() => <AuthenticatedRoute component={Employees} />} />

      <Route path="/import" component={() => <AuthenticatedRoute component={Import} />} />
      <Route path="/export" component={() => <AuthenticatedPlaceholder title="Eksport rezerwacji" description="Eksport danych rezerwacji do pliku." />} />
      <Route path="/user-accounts" component={() => <AuthenticatedRoute component={UserAccounts} />} />
      <Route path="/locations" component={() => <AuthenticatedRoute component={Lokalizacje} />} />

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

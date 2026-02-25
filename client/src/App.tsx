import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/Dashboard";
import Apartments from "@/pages/Apartments";
import Owners from "@/pages/Owners";
import RezerwacjeAll from "@/pages/RezerwacjeAll";
import Leases from "@/pages/Leases";
import Finance from "@/pages/Finance";
import ImportBackup from "@/pages/ImportBackup";
import Landing from "@/pages/Landing";
import Employees from "@/pages/Employees";
import Terminarz from "@/pages/Terminarz";
import Lokalizacje from "@/pages/Lokalizacje";
import ServiceContracts from "@/pages/ServiceContracts";
import Podnajem from "@/pages/Podnajem";
import UserAccounts from "@/pages/UserAccounts";
import Saldo from "@/pages/Saldo";
import DocumentTemplates from "@/pages/DocumentTemplates";
import ActivityLog from "@/pages/ActivityLog";
import PlaceholderPage from "@/pages/Placeholder";
import ReportExport from "@/pages/ReportExport";
import Invoices from "@/pages/Invoices";
import CompanySettings from "@/pages/CompanySettings";
import DokumentyKsiegowe from "@/pages/DokumentyKsiegowe";
import TechnicalInspections from "@/pages/TechnicalInspections";
import Ustawienia from "@/pages/Ustawienia";
import Customers from "@/pages/Customers";
import Tasks from "@/pages/Tasks";
import SourceComparison from "@/pages/SourceComparison";
import OccupancyRates from "@/pages/OccupancyRates";
import Profitability from "@/pages/Profitability";
import YearComparison from "@/pages/YearComparison";
import ApartmentComparison from "@/pages/ApartmentComparison";
import PriceSeasonality from "@/pages/PriceSeasonality";
import SaldoFirmowe from "@/pages/SaldoFirmowe";
import V2Przychody from "@/pages/V2Przychody";
import V2Koszty from "@/pages/V2Koszty";
import PriorityRevenueForecast from "@/pages/PriorityRevenueForecast";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ThemeProvider";

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

const LAST_PATH_KEY = "baltyckie_last_path";

function useRouteRestoration() {
  const [location, setLocation] = useLocation();
  const restored = useRef(false);

  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const savedPath = sessionStorage.getItem(LAST_PATH_KEY);
      if (savedPath && savedPath !== location) {
        setLocation(savedPath);
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(LAST_PATH_KEY, location);
  }, [location]);
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

  return <AuthenticatedRouter />;
}

function AuthenticatedRouter() {
  useRouteRestoration();

  return (
    <Switch>
      <Route path="/" component={() => <AuthenticatedRoute component={Dashboard} />} />
      <Route path="/calendar" component={() => <AuthenticatedRoute component={Terminarz} />} />

      <Route path="/reservations" component={() => <AuthenticatedRoute component={RezerwacjeAll} />} />
      <Route path="/leases" component={() => <AuthenticatedRoute component={Leases} />} />

      <Route path="/invoices" component={() => <AuthenticatedRoute component={Invoices} />} />
      <Route path="/contracts-services" component={() => <AuthenticatedRoute component={ServiceContracts} />} />
      <Route path="/przeglady" component={() => <AuthenticatedRoute component={TechnicalInspections} />} />
      <Route path="/dokumenty-ksiegowe" component={() => <AuthenticatedRoute component={DokumentyKsiegowe} />} />
      <Route path="/salda" component={() => <AuthenticatedRoute component={Saldo} />} />
      <Route path="/saldo-ml" component={() => <Layout><Saldo personName="Małgorzata Latasiewicz" /></Layout>} />
      <Route path="/saldo-jg" component={() => <Layout><Saldo personName="Jolanta Głodkowska" /></Layout>} />
      <Route path="/saldo-mc" component={() => <Layout><Saldo personName="Mateusz Cieślak" /></Layout>} />
      <Route path="/finance" component={() => <AuthenticatedRoute component={Finance} />} />

      <Route path="/podnajem" component={() => <AuthenticatedRoute component={Podnajem} />} />

      <Route path="/ustawienia" component={() => <AuthenticatedRoute component={Ustawienia} />} />
      <Route path="/apartments" component={() => <AuthenticatedRoute component={Apartments} />} />
      <Route path="/owners" component={() => <AuthenticatedRoute component={Owners} />} />
      <Route path="/employees" component={() => <AuthenticatedRoute component={Employees} />} />
      <Route path="/locations" component={() => <AuthenticatedRoute component={Lokalizacje} />} />
      <Route path="/document-templates" component={() => <AuthenticatedRoute component={DocumentTemplates} />} />
      <Route path="/user-accounts" component={() => <AuthenticatedRoute component={UserAccounts} />} />
      <Route path="/company-settings" component={() => <AuthenticatedRoute component={CompanySettings} />} />
      <Route path="/reports" component={() => <AuthenticatedRoute component={ReportExport} />} />
      <Route path="/import-export" component={() => <AuthenticatedRoute component={ImportBackup} />} />
      <Route path="/activity-log" component={() => <AuthenticatedRoute component={ActivityLog} />} />
      <Route path="/customers" component={() => <AuthenticatedRoute component={Customers} />} />
      <Route path="/tasks" component={() => <AuthenticatedRoute component={Tasks} />} />
      <Route path="/source-comparison" component={() => <AuthenticatedRoute component={SourceComparison} />} />
      <Route path="/v2/przychody" component={() => <AuthenticatedRoute component={V2Przychody} />} />
      <Route path="/v2/koszty" component={() => <AuthenticatedRoute component={V2Koszty} />} />
      <Route path="/v2/prognoza-przychodow" component={() => <AuthenticatedRoute component={PriorityRevenueForecast} />} />
      <Route path="/ustawienia-menu" component={() => <Redirect to="/ustawienia" />} />

      <Route path="/koszty">{() => <Redirect to="/v2/koszty" />}</Route>
      <Route path="/costs-expenses" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/costs-apartments" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/koszty-apartamentowe" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/koszty-operacyjne" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/revenue" component={() => <Redirect to="/v2/przychody" />} />
      <Route path="/finance-forecast" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/contracts-subrent" component={() => <Redirect to="/podnajem" />} />
      <Route path="/subrent-settlement" component={() => <Redirect to="/podnajem?tab=rozliczenia" />} />
      <Route path="/subrent-media" component={() => <Redirect to="/podnajem?tab=media" />} />
      <Route path="/arrivals" component={() => <Redirect to="/reservations?tab=przyjazdy" />} />
      <Route path="/backup" component={() => <Redirect to="/import-export" />} />
      <Route path="/occupancy" component={() => <AuthenticatedRoute component={OccupancyRates} />} />
      <Route path="/profitability" component={() => <AuthenticatedRoute component={Profitability} />} />
      <Route path="/year-comparison" component={() => <AuthenticatedRoute component={YearComparison} />} />
      <Route path="/apartment-comparison" component={() => <AuthenticatedRoute component={ApartmentComparison} />} />
      <Route path="/price-seasonality" component={() => <AuthenticatedRoute component={PriceSeasonality} />} />
      <Route path="/saldo-firmowe" component={() => <AuthenticatedRoute component={SaldoFirmowe} />} />
      <Route path="/cash-flow-forecast" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/analizy" component={() => <Redirect to="/v2/przychody" />} />
      <Route path="/apartment-schedule" component={() => <Redirect to="/v2/koszty" />} />
      <Route path="/v2/prognoza" component={() => <Redirect to="/ustawienia" />} />
      <Route path="/v2/realizacja" component={() => <Redirect to="/v2/przychody" />} />

      <Route component={() => <AuthenticatedRoute component={NotFound} />} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

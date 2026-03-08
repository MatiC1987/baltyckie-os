import { useEffect, useRef, lazy, Suspense } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import Landing from "@/pages/Landing";
import { Layout } from "@/components/Layout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TablePageSkeleton, DashboardSkeleton, AnalyticsSkeleton } from "@/components/PageSkeleton";
import { UpdateNotification } from "@/components/UpdateNotification";

const RecepcjaApp = lazy(() => import("@/pages/recepcja/RecepcjaApp"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ApartamentyHub = lazy(() => import("@/pages/ApartamentyHub"));
const Owners = lazy(() => import("@/pages/Owners"));
const RezerwacjeAll = lazy(() => import("@/pages/RezerwacjeAll"));
const Leases = lazy(() => import("@/pages/Leases"));
const Finance = lazy(() => import("@/pages/Finance"));
const ImportBackup = lazy(() => import("@/pages/ImportBackup"));
const Terminarz = lazy(() => import("@/pages/Terminarz"));
const ServiceContracts = lazy(() => import("@/pages/ServiceContracts"));
const Podnajem = lazy(() => import("@/pages/Podnajem"));
const UserAccounts = lazy(() => import("@/pages/UserAccounts"));
const Saldo = lazy(() => import("@/pages/Saldo"));
const DocumentTemplates = lazy(() => import("@/pages/DocumentTemplates"));
const ActivityLog = lazy(() => import("@/pages/ActivityLog"));
const PlaceholderPage = lazy(() => import("@/pages/Placeholder"));
const ReportExport = lazy(() => import("@/pages/ReportExport"));
const CompanySettings = lazy(() => import("@/pages/CompanySettings"));
const DokumentyHub = lazy(() => import("@/pages/DokumentyHub"));
const Ustawienia = lazy(() => import("@/pages/Ustawienia"));
const Customers = lazy(() => import("@/pages/Customers"));
const SourceComparison = lazy(() => import("@/pages/SourceComparison"));
const OccupancyRates = lazy(() => import("@/pages/OccupancyRates"));
const Profitability = lazy(() => import("@/pages/Profitability"));
const YearComparison = lazy(() => import("@/pages/YearComparison"));
const ApartmentComparison = lazy(() => import("@/pages/ApartmentComparison"));
const PriceSeasonality = lazy(() => import("@/pages/PriceSeasonality"));
const SaldoFirmowe = lazy(() => import("@/pages/SaldoFirmowe"));
const PrzychodyHub = lazy(() => import("@/pages/PrzychodyHub"));
const V2Koszty = lazy(() => import("@/pages/V2Koszty"));
const TimeClock = lazy(() => import("@/pages/TimeClock"));
const TimeAdmin = lazy(() => import("@/pages/TimeAdmin"));
const PracownicyHub = lazy(() => import("@/pages/PracownicyHub"));
const BankStatementImport = lazy(() => import("@/pages/BankStatementImport"));
const BankConnections = lazy(() => import("@/pages/BankConnections"));
const SprawySadowe = lazy(() => import("@/pages/SprawySadowe"));

function LazyFallback() {
  return (
    <div className="p-6 space-y-6">
      <DashboardSkeleton />
    </div>
  );
}

function AuthenticatedRoute({ component: Component }: { component: React.LazyExoticComponent<any> | (() => JSX.Element) }) {
  return (
    <Layout>
      <Suspense fallback={<LazyFallback />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function AuthenticatedPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <Layout>
      <Suspense fallback={<LazyFallback />}>
        <PlaceholderPage title={title} description={description} />
      </Suspense>
    </Layout>
  );
}

function NavRedirect({ to, tab }: { to: string; tab: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = to;
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
    setLocation(to);
  }, [to, tab, setLocation]);
  return null;
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
  const [location] = useLocation();
  const prevPathRef = useRef(location);

  useEffect(() => {
    const getPrefix = (p: string) => {
      if (p.startsWith('/recepcja')) return '/recepcja';
      if (p.startsWith('/rcp')) return '/rcp';
      return '/';
    };
    if (getPrefix(location) !== getPrefix(prevPathRef.current)) {
      import('./main').then((m) => m.setManifestForPath(location)).catch(() => {});
    }
    prevPathRef.current = location;
  }, [location]);

  if (location === "/rcp") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <TimeClock />
      </Suspense>
    );
  }

  if (location.startsWith("/recepcja")) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <RecepcjaApp />
      </Suspense>
    );
  }

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

      <Route path="/dokumenty-ksiegowe" component={() => <AuthenticatedRoute component={DokumentyHub} />} />
      <Route path="/contracts-services" component={() => <AuthenticatedRoute component={ServiceContracts} />} />
      <Route path="/salda" component={() => <AuthenticatedRoute component={Saldo} />} />
      <Route path="/saldo-ml" component={() => <Layout><Suspense fallback={<LazyFallback />}><Saldo personName="Małgorzata Latasiewicz" /></Suspense></Layout>} />
      <Route path="/saldo-jg" component={() => <Layout><Suspense fallback={<LazyFallback />}><Saldo personName="Jolanta Głodkowska" /></Suspense></Layout>} />
      <Route path="/saldo-mc" component={() => <Layout><Suspense fallback={<LazyFallback />}><Saldo personName="Mateusz Cieślak" /></Suspense></Layout>} />
      <Route path="/finance" component={() => <AuthenticatedRoute component={Finance} />} />

      <Route path="/podnajem" component={() => <AuthenticatedRoute component={Podnajem} />} />

      <Route path="/ustawienia" component={() => <AuthenticatedRoute component={Ustawienia} />} />
      <Route path="/apartments" component={() => <AuthenticatedRoute component={ApartamentyHub} />} />
      <Route path="/owners" component={() => <AuthenticatedRoute component={Owners} />} />
      <Route path="/pracownicy" component={() => <AuthenticatedRoute component={PracownicyHub} />} />
      <Route path="/document-templates" component={() => <AuthenticatedRoute component={DocumentTemplates} />} />
      <Route path="/user-accounts" component={() => <AuthenticatedRoute component={UserAccounts} />} />
      <Route path="/company-settings" component={() => <AuthenticatedRoute component={CompanySettings} />} />
      <Route path="/reports" component={() => <AuthenticatedRoute component={ReportExport} />} />
      <Route path="/import-export" component={() => <AuthenticatedRoute component={ImportBackup} />} />
      <Route path="/activity-log" component={() => <AuthenticatedRoute component={ActivityLog} />} />
      <Route path="/customers" component={() => <AuthenticatedRoute component={Customers} />} />
      <Route path="/source-comparison" component={() => <AuthenticatedRoute component={SourceComparison} />} />
      <Route path="/v2/przychody" component={() => <AuthenticatedRoute component={PrzychodyHub} />} />
      <Route path="/v2/koszty" component={() => <AuthenticatedRoute component={V2Koszty} />} />
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
      <Route path="/rcp/admin" component={() => <AuthenticatedRoute component={TimeAdmin} />} />
      <Route path="/import-bankowy" component={() => <AuthenticatedRoute component={BankStatementImport} />} />
      <Route path="/bank-connections" component={() => <AuthenticatedRoute component={BankConnections} />} />
      <Route path="/sprawy-sadowe" component={() => <AuthenticatedRoute component={SprawySadowe} />} />

      <Route path="/locations" component={() => <NavRedirect to="/apartments" tab="lokalizacje" />} />
      <Route path="/przeglady" component={() => <NavRedirect to="/apartments" tab="przeglady" />} />
      <Route path="/usterki" component={() => <NavRedirect to="/apartments" tab="usterki" />} />
      <Route path="/invoices" component={() => <NavRedirect to="/dokumenty-ksiegowe" tab="faktury" />} />
      <Route path="/rcp/statystyki" component={() => <Redirect to="/rcp/admin" />} />
      <Route path="/szkolenia" component={() => <NavRedirect to="/pracownicy" tab="szkolenia" />} />
      <Route path="/umowy-pracownicze" component={() => <NavRedirect to="/pracownicy" tab="umowy" />} />
      <Route path="/lista-plac" component={() => <NavRedirect to="/pracownicy" tab="lista-plac" />} />
      <Route path="/employees" component={() => <NavRedirect to="/pracownicy" tab="lista" />} />
      <Route path="/rozliczenie-checkout" component={() => <NavRedirect to="/podnajem" tab="checkout" />} />
      <Route path="/v2/prognoza-przychodow" component={() => <NavRedirect to="/v2/przychody" tab="prognoza" />} />

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
          <UpdateNotification />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

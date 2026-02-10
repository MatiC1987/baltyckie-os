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
import Leases from "@/pages/Leases";
import Finance from "@/pages/Finance";
import Import from "@/pages/Import";
import Arrivals from "@/pages/Arrivals";
import Landing from "@/pages/Landing";
import { Layout } from "@/components/Layout";

function AuthenticatedRoute({ component: Component }: { component: () => JSX.Element }) {
  return (
    <Layout>
      <Component />
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
      <Route path="/apartments" component={() => <AuthenticatedRoute component={Apartments} />} />
      <Route path="/owners" component={() => <AuthenticatedRoute component={Owners} />} />
      <Route path="/reservations" component={() => <AuthenticatedRoute component={Reservations} />} />
      <Route path="/arrivals" component={() => <AuthenticatedRoute component={Arrivals} />} />
      <Route path="/leases" component={() => <AuthenticatedRoute component={Leases} />} />
      <Route path="/finance" component={() => <AuthenticatedRoute component={Finance} />} />
      <Route path="/import" component={() => <AuthenticatedRoute component={Import} />} />
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

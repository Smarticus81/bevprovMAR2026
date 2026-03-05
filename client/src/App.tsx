import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Pricing from "@/pages/Pricing";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

const AgentBuilder = lazy(() => import("@/pages/AgentBuilder"));
const AppStore = lazy(() => import("@/pages/AppStore"));
const AgentApp = lazy(() => import("@/pages/AgentApp"));
const VenueData = lazy(() => import("@/pages/VenueData"));

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function LazyFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>
        <Route path="/dashboard/agents/:id">
          {() => <ProtectedRoute component={AgentBuilder} />}
        </Route>
        <Route path="/dashboard/venue">
          {() => <ProtectedRoute component={VenueData} />}
        </Route>
        <Route path="/dashboard/store">
          {() => <ProtectedRoute component={AppStore} />}
        </Route>
        <Route path="/app/:agentId">
          {() => <ProtectedRoute component={AgentApp} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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

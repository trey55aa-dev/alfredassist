import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import AppLayout from "./components/AppLayout";

// Route-level code splitting — each page is its own chunk, fetched on demand.
// This keeps the initial download to the shell + whatever the first route needs,
// instead of shipping all ~16 pages (and heavy deps like recharts) up front.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Checklist = lazy(() => import("./pages/Checklist"));
const Focus = lazy(() => import("./pages/Focus"));
const BrainDump = lazy(() => import("./pages/BrainDump"));
const Planner = lazy(() => import("./pages/Planner"));
const Guide = lazy(() => import("./pages/Guide"));
const Journal = lazy(() => import("./pages/Journal"));
const Goals2026 = lazy(() => import("./pages/Goals2026"));
const Agenda = lazy(() => import("./pages/Agenda"));
const CustomLists = lazy(() => import("./pages/CustomLists"));
const Auth = lazy(() => import("./pages/Auth"));
const Health = lazy(() => import("./pages/Health"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Review = lazy(() => import("./pages/Review"));
const Mood = lazy(() => import("./pages/Mood"));
const Notion = lazy(() => import("./pages/Notion"));
const NFLPredictor = lazy(() => import("./pages/NFLPredictor"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

/**
 * Warm every route chunk once the browser is idle, so moving between features
 * is instant — no "Awakening Alfred…" flash after the first minute of use.
 * Purely a cache warm-up: failures are ignored (chunks load on demand anyway).
 */
function usePrefetchRoutes() {
  useEffect(() => {
    const prefetch = () => {
      Promise.allSettled([
        import("./pages/Dashboard"),
        import("./pages/Checklist"),
        import("./pages/Focus"),
        import("./pages/BrainDump"),
        import("./pages/Planner"),
        import("./pages/Guide"),
        import("./pages/Journal"),
        import("./pages/Goals2026"),
        import("./pages/Agenda"),
        import("./pages/CustomLists"),
        import("./pages/Health"),
        import("./pages/Achievements"),
        import("./pages/Schedule"),
        import("./pages/Review"),
        import("./pages/Mood"),
        import("./pages/Notion"),
        import("./pages/NFLPredictor"),
      ]);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(t);
  }, []);
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold animate-pulse">
        Awakening Alfred…
      </div>
    </div>
  );
}

const App = () => {
  usePrefetchRoutes();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/checklist" element={<Checklist />} />
                <Route path="/focus" element={<Focus />} />
                <Route path="/brain-dump" element={<BrainDump />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/goals-2026" element={<Goals2026 />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/lists" element={<CustomLists />} />
                <Route path="/health" element={<Health />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/review" element={<Review />} />
                <Route path="/mood" element={<Mood />} />
                <Route path="/notion" element={<Notion />} />
                <Route path="/nfl" element={<NFLPredictor />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

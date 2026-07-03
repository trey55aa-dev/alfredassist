import { lazy, Suspense } from "react";
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
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-gold animate-pulse">
        Awakening Alfred…
      </div>
    </div>
  );
}

const App = () => (
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
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

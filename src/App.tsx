import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Checklist from "./pages/Checklist";
import Focus from "./pages/Focus";
import BrainDump from "./pages/BrainDump";
import Planner from "./pages/Planner";
import Guide from "./pages/Guide";
import Journal from "./pages/Journal";
import Goals2026 from "./pages/Goals2026";
import Agenda from "./pages/Agenda";
import CustomLists from "./pages/CustomLists";
import Auth from "./pages/Auth";
import Health from "./pages/Health";
import Achievements from "./pages/Achievements";
import Schedule from "./pages/Schedule";
import Review from "./pages/Review";
import Mood from "./pages/Mood";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

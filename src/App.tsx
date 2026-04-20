import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Checklist from "./pages/Checklist";
import Focus from "./pages/Focus";
import BrainDump from "./pages/BrainDump";
import Planner from "./pages/Planner";
import Guide from "./pages/Guide";
import Journal from "./pages/Journal";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/brain-dump" element={<BrainDump />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/journal" element={<Journal />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

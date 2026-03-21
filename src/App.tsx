import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBarometerStore } from "@/store/useBarometerStore";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AppLayout from "@/components/layout/AppLayout";
import HomePage from "@/pages/HomePage";
import GroupDashboard from "@/pages/GroupDashboard";
import OfficeDashboard from "@/pages/OfficeDashboard";
import ExportsPage from "@/pages/ExportsPage";
import AdminPage from "@/pages/AdminPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppInit({ children }: { children: React.ReactNode }) {
  const loadData = useBarometerStore((s) => s.loadData);
  useEffect(() => { loadData(); }, [loadData]);
  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<null | "loading" | "authenticated">("loading");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ? "authenticated" : null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ? "authenticated" : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdmin();
  if (isAdmin === null) return null; // loading
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGate>
          <AppInit>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/group" element={<GroupDashboard />} />
                <Route path="/office" element={<OfficeDashboard />} />
                <Route path="/exports" element={<ExportsPage />} />
                <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppInit>
        </AuthGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

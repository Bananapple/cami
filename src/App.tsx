import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { StudioProvider, useStudioContext } from "@/context/StudioContext";
import { initStudio } from "@/integrations/posthog";
import Index from "./pages/Index";
import Programs from "./pages/Programs";
import Coaches from "./pages/Coaches";
import Insights from "./pages/Insights";
import JoinNow from "./pages/JoinNow";
import Dashboard from "./pages/Dashboard";
import ArticleDetail from "./pages/ArticleDetail";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import { ManageApp } from "./manage/ManageApp";
import { PrimitivesPreview } from "./manage-v2/_dev/PrimitivesPreview";
import { ShellPreview } from "./manage-v2/_dev/ShellPreview";
import { ManageV2App } from "./manage-v2/ManageV2App";
import CamiHome from "./pages/CamiHome";

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const PostHogStudioSync = () => {
  const ctx = useStudioContext();
  useEffect(() => {
    if (ctx?.studio?.id) initStudio(ctx.studio.id);
  }, [ctx?.studio?.id]);
  return null;
};

const RefCapture = () => {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      sessionStorage.setItem("brie_ref_code", ref.trim().toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  return null;
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {/* Marketing routes — no studio context needed */}
      <Routes>
        <Route path="/cami" element={<CamiHome />} />
        {import.meta.env.VITE_DEPLOY_TARGET === "cami" && (
          <Route path="/" element={<CamiHome />} />
        )}
      </Routes>
      <StudioProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ScrollToTop />
          <RefCapture />
          <PostHogStudioSync />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/classes" element={<Programs />} />
            <Route path="/teachers" element={<Coaches />} />
            <Route path="/journal" element={<Insights />} />
            <Route path="/joinnow" element={<JoinNow />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* v2 is now the default at /manage/* */}
            <Route path="/manage/*" element={<ManageV2App />} />
            {/* Legacy /manage available for rollback */}
            <Route path="/manage-legacy/*" element={<ManageApp />} />
            {/* Dev / design references */}
            <Route path="/_v2/primitives" element={<PrimitivesPreview />} />
            <Route path="/_v2/shell" element={<ShellPreview />} />
            <Route path="/insights/:slug" element={<ArticleDetail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </StudioProvider>
    </BrowserRouter>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

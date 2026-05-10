import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import CamiHome from "./marketing/CamiHome";
import { isMarketingHost } from "./marketing/isMarketingHost";

const queryClient = new QueryClient();

// Marketing-domain styling (Fraunces font override) is gated on hostname,
// not on a build-time env var, so a single deployment can serve both
// surfaces correctly. See docs/ARCHITECTURE.md.
if (isMarketingHost()) {
  document.documentElement.classList.add("deploy-cami");
}

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

// Marketing surface — heycami.studio. Renders only marketing routes.
// Does NOT mount StudioProvider, ref capture, PostHog studio sync, or any
// studio app routes. Any studio-shaped path (/manage, /dashboard, /joinnow,
// /classes, etc.) on a marketing host redirects to /. See docs/ARCHITECTURE.md.
const MarketingApp = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<CamiHome />} />
          <Route path="/cami" element={<CamiHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

// Studio surface — every yoga-studio deployment (brie-hd7s.vercel.app, etc.).
// Mounts StudioProvider so the slug/subdomain resolves a tenant.
// Marketing pages (/cami) remain accessible here as a preview surface.
const StudioApp = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudioProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ScrollToTop />
            <RefCapture />
            <PostHogStudioSync />
            <Routes>
              <Route path="/cami" element={<CamiHome />} />
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

const App = () => (isMarketingHost() ? <MarketingApp /> : <StudioApp />);

export default App;

/* Academia — application root: providers, hash router, route-guard FSM,
   and Route-Level Code Splitting with Skeletal Suspense shells */

import React, { lazy, Suspense, useEffect } from "react";
import { AppProvider, useApp } from "@/engine/store";
import { ModalProvider } from "@/engine/modal";
import { useRoute, navigate, isExcludedRoute, isAppRoute } from "@/engine/router";
import { ToastHost, ViewSkeleton } from "@/components/ui";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Shell } from "@/components/navigation/shell";
import { LandingView } from "@/views/landing";
import { AuthView } from "@/views/auth";
import { QuestionnaireView } from "@/views/questionnaire";
import { ProvisioningView } from "@/views/provisioning";
import { StatusView } from "@/views/status";

// Route-Level Code Splitting with native React.lazy()
const DashboardView = lazy(() => import("@/views/dashboard").then(m => ({ default: m.DashboardView })));
const LibraryView = lazy(() => import("@/views/library").then(m => ({ default: m.LibraryView })));
const MediaView = lazy(() => import("@/views/media").then(m => ({ default: m.MediaView })));
const PortfolioView = lazy(() => import("@/views/portfolio").then(m => ({ default: m.PortfolioView })));
const SandboxView = lazy(() => import("@/views/sandbox").then(m => ({ default: m.SandboxView })));
const LockerView = lazy(() => import("@/views/locker").then(m => ({ default: m.LockerView })));
const CatalystView = lazy(() => import("@/views/catalyst").then(m => ({ default: m.CatalystView })));
const ScratchpadView = lazy(() => import("@/views/scratchpad").then(m => ({ default: m.ScratchpadView })));
const InventoryView = lazy(() => import("@/views/inventory").then(m => ({ default: m.InventoryView })));
const AnnouncementsView = lazy(() => import("@/views/announcements").then(m => ({ default: m.AnnouncementsView })));
const NumeraView = lazy(() => import("@/views/numera").then(m => ({ default: m.NumeraView })));
const TallyView = lazy(() => import("@/views/tally").then(m => ({ default: m.TallyView })));
const PomodoroView = lazy(() => import("@/views/pomodoro").then(m => ({ default: m.PomodoroView })));
const AdoroView = lazy(() => import("@/views/adoro").then(m => ({ default: m.AdoroView })));
const WorkbenchView = lazy(() => import("@/views/workbench").then(m => ({ default: m.WorkbenchView })));
const CommunityView = lazy(() => import("@/views/community").then(m => ({ default: m.CommunityView })));
const AtlasView = lazy(() => import("@/views/atlas").then(m => ({ default: m.AtlasView })));
const AdminDashboardView = lazy(() => import("@/views/admin/dashboard").then(m => ({ default: m.AdminDashboardView })));
const AdminStudentsView = lazy(() => import("@/views/admin/students").then(m => ({ default: m.AdminStudentsView })));

const APP_VIEWS: Record<string, React.ComponentType> = {
  "/dashboard": DashboardView,
  "/library": LibraryView,
  "/media": MediaView,
  "/portfolio": PortfolioView,
  "/sandbox": SandboxView,
  "/locker": LockerView,
  "/catalyst": CatalystView,
  "/scratchpad": ScratchpadView,
  "/inventory": InventoryView,
  "/announcements": AnnouncementsView,
  "/numera": NumeraView,
  "/tally": TallyView,
  "/pomodoro": PomodoroView,
  "/adoro": AdoroView,
  "/workbench": WorkbenchView,
  "/community": CommunityView,
  "/atlas": AtlasView,
  "/admin/dashboard": AdminDashboardView,
  "/admin/students": AdminStudentsView,
};

function Root() {
  const { s, up, toast } = useApp();
  const path = useRoute();
  const base = path.split("?")[0];
  const sess = s.session;
  const appRoute = isAppRoute(base) && base in APP_VIEWS;

  /* guard resolution — synchronous so protected content never flashes */
  let guard: string | null = null;
  if (sess.status === "BAN" && (appRoute || base === "/questionnaire" || base === "/provisioning")) guard = "/banned";
  else if (sess.status === "INACTIVE" && (sess.inactiveUntil ?? 0) > Date.now() && (appRoute || base === "/questionnaire" || base === "/provisioning")) guard = "/inactive";
  else if (!sess.authed && appRoute) guard = "/auth";
  else if (sess.authed && sess.stage === "questionnaire" && appRoute) guard = "/questionnaire";
  else if (sess.authed && sess.stage === "provisioning" && appRoute) guard = "/provisioning";
  else if ((base === "/questionnaire" || base === "/provisioning") && !sess.authed) guard = "/auth";
  else if (base.startsWith("/admin") && appRoute && sess.role !== "admin") guard = "/dashboard";

  useEffect(() => {
    if (guard && guard !== base) navigate(guard);
  }, [guard, base]);

  /* auto-restore expired usage pauses */
  useEffect(() => {
    if (sess.status === "INACTIVE" && sess.inactiveUntil && sess.inactiveUntil <= Date.now()) {
      up(d => { d.session.status = "ACTIVE"; d.session.inactiveUntil = undefined; });
      toast("Usage pause expired — access restored", "ok");
      if (base === "/inactive") navigate("/dashboard");
    }
  }, [sess.status, sess.inactiveUntil, base]); // eslint-disable-line react-hooks/exhaustive-deps

  let content: React.ReactElement;
  if (guard === "/banned" || guard === "/inactive") content = <StatusView kind={guard} />;
  else if (guard === "/auth") content = <AuthView />;
  else if (guard === "/questionnaire") content = <QuestionnaireView />;
  else if (guard === "/provisioning") content = <ProvisioningView />;
  else if (base === "/") content = <LandingView />;
  else if (base === "/auth") content = <AuthView />;
  else if (base === "/questionnaire") content = <QuestionnaireView />;
  else if (base === "/provisioning") content = <ProvisioningView />;
  else if (isExcludedRoute(base)) content = <StatusView kind={base} />;
  else if (guard === "/dashboard") {
    content = (
      <Shell path="/dashboard">
        <Suspense fallback={<ViewSkeleton route="/dashboard" />}>
          <DashboardView />
        </Suspense>
      </Shell>
    );
  } else if (appRoute) {
    const View = APP_VIEWS[base];
    content = (
      <Shell path={base}>
        <Suspense fallback={<ViewSkeleton route={base} />}>
          <View key={path} />
        </Suspense>
      </Shell>
    );
  } else {
    content = <StatusView kind="/404" />;
  }

  return (
    <>
      {content}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ModalProvider>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </ModalProvider>
    </AppProvider>
  );
}

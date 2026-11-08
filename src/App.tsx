/* Academia — application root: providers, hash router, route-guard FSM */
import { useEffect } from "react";
import { AppProvider, useApp } from "@/engine/store";
import { ModalProvider } from "@/engine/modal";
import { useRoute, navigate, isExcludedRoute, isAppRoute } from "@/engine/router";
import { ToastHost } from "@/components/ui";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Shell } from "@/components/navigation/shell";
import { LandingView } from "@/views/landing";
import { AuthView } from "@/views/auth";
import { QuestionnaireView } from "@/views/questionnaire";
import { ProvisioningView } from "@/views/provisioning";
import { StatusView } from "@/views/status";
import { DashboardView } from "@/views/dashboard";
import { LibraryView } from "@/views/library";
import { MediaView } from "@/views/media";
import { PortfolioView } from "@/views/portfolio";
import { SandboxView } from "@/views/sandbox";
import { LockerView } from "@/views/locker";
import { CatalystView } from "@/views/catalyst";
import { ScratchpadView } from "@/views/scratchpad";
import { InventoryView } from "@/views/inventory";
import { AnnouncementsView } from "@/views/announcements";
import { NumeraView } from "@/views/numera";
import { TallyView } from "@/views/tally";
import { PomodoroView } from "@/views/pomodoro";
import { AdoroView } from "@/views/adoro";
import { WorkbenchView } from "@/views/workbench";
import { CommunityView } from "@/views/community";
import { AtlasView } from "@/views/atlas";
import { AdminDashboardView } from "@/views/admin/dashboard";
import { AdminStudentsView } from "@/views/admin/students";

const APP_VIEWS: Record<string, () => React.ReactElement> = {
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
  else if (guard === "/dashboard") content = <Shell path="/dashboard"><DashboardView /></Shell>;
  else if (appRoute) {
    const View = APP_VIEWS[base];
    content = <Shell path={base}><View key={path} /></Shell>;
  } else content = <StatusView kind="/404" />;

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
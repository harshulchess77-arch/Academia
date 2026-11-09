/* Academia — application root: providers, hash router, route-guard FSM,
   Route-Level Code Splitting, and Strict Administrative Isolation Barrier. */

import React, { createContext, useContext, lazy, Suspense, useEffect } from "react";
import { AppProvider, useApp, ENV, verifyAdminClaims, type SessionClaims } from "@/engine/store";
import { ModalProvider } from "@/engine/modal";
import { useRoute, navigate, isExcludedRoute, isAppRoute, isAdminRoute } from "@/engine/router";
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
const TutorView = lazy(() => import("@/views/tutor").then(m => ({ default: m.TutorView })));
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
const AdminConsoleView = lazy(() => import("@/views/AdminConsole").then(m => ({ default: m.AdminConsoleView })));
const AdminDashboardView = lazy(() => import("@/views/admin/dashboard").then(m => ({ default: m.AdminDashboardView })));
const AdminStudentsView = lazy(() => import("@/views/admin/students").then(m => ({ default: m.AdminStudentsView })));

const APP_VIEWS: Record<string, React.ComponentType> = {
  "/dashboard": DashboardView,
  "/library": LibraryView,
  "/tutor": TutorView,
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
  "/admin": AdminConsoleView,
  "/admin/console": AdminConsoleView,
  "/admin/dashboard": AdminDashboardView,
  "/admin/students": AdminStudentsView,
};

interface AdminGuardContextValue {
  isVerifiedAdmin: boolean;
  claims: SessionClaims | null;
  adminId: string;
}

export const AdminGuardContext = createContext<AdminGuardContextValue | null>(null);

export function useAdminGuard(): AdminGuardContextValue {
  const ctx = useContext(AdminGuardContext);
  if (!ctx || !ctx.isVerifiedAdmin) {
    throw new Error("AdminGuard: Unauthorized invocation outside verified administrative barrier.");
  }
  return ctx;
}

/**
 * Strict Administrative Isolation Barrier.
 * Config-guards all admin routes, verifies JWT claims, and forces eviction & liquidation on violation.
 */
function AdminIsolationBarrier({ children }: { children: React.ReactNode }) {
  const { s } = useApp();
  const isVerified = verifyAdminClaims(s.session);

  if (!isVerified) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#17110b] p-6 text-[#fbf7ee]">
        <div className="max-w-md text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-[#e87055]">Security Exception</p>
          <h1 className="font-display text-2xl font-black">Administrative Isolation Barrier</h1>
          <p className="font-mono text-xs opacity-75">
            Cryptographic audit breach. Role claims missing or invalid. Evicting and liquidating credentials.
          </p>
        </div>
      </div>
    );
  }

  const value: AdminGuardContextValue = {
    isVerifiedAdmin: true,
    claims: s.session.tokenClaims ?? null,
    adminId: s.session.email || "academia_governance_admin",
  };

  return (
    <AdminGuardContext.Provider value={value}>
      {children}
    </AdminGuardContext.Provider>
  );
}

function Root() {
  const { s, up, toast, liquidateSession } = useApp();
  const path = useRoute();
  const base = path.split("?")[0];
  const sess = s.session;
  const appRoute = isAppRoute(base) && base in APP_VIEWS;
  const adminAttempt = isAdminRoute(base);

  /* guard resolution — synchronous so protected content never flashes */
  let guard: string | null = null;
  if (sess.status === "BAN" && (appRoute || base === "/questionnaire" || base === "/provisioning")) guard = "/banned";
  else if (sess.status === "INACTIVE" && (sess.inactiveUntil ?? 0) > Date.now() && (appRoute || base === "/questionnaire" || base === "/provisioning")) guard = "/inactive";
  else if (adminAttempt && (!sess.authed || !verifyAdminClaims(sess))) {
    // Immediate administrative isolation guard
    guard = "/auth";
  }
  else if (!sess.authed && appRoute) guard = "/auth";
  else if (sess.authed && sess.stage === "questionnaire" && appRoute) guard = "/questionnaire";
  else if (sess.authed && sess.stage === "provisioning" && appRoute) guard = "/provisioning";
  else if ((base === "/questionnaire" || base === "/provisioning") && !sess.authed) guard = "/auth";

  useEffect(() => {
    if (guard && guard !== base) {
      if (adminAttempt && (!sess.authed || !verifyAdminClaims(sess))) {
        liquidateSession("Administrative boundary breached: Missing or unverified claims. Session liquidated.");
      }
      navigate(guard);
    }
  }, [guard, base]); // eslint-disable-line react-hooks/exhaustive-deps

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
  else if (adminAttempt && appRoute) {
    const View = APP_VIEWS[base] ?? AdminConsoleView;
    content = (
      <AdminIsolationBarrier>
        <Shell path={base}>
          <Suspense fallback={<ViewSkeleton route={base} />}>
            <View key={path} />
          </Suspense>
        </Shell>
      </AdminIsolationBarrier>
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
  if (ENV.appEnv === "production" && (!ENV.supabaseUrl || !ENV.supabaseAnonKey)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#17110b] p-6 text-[#fbf7ee]">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display text-2xl font-black">Configuration Error</h1>
          <p className="font-mono text-xs opacity-75">
            Production environment infrastructure parameter invariants breached. Service halted.
          </p>
        </div>
      </div>
    );
  }

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

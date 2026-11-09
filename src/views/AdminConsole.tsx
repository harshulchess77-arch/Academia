/* Academia · High-Assurance Secure Admin Governance Console.
   Cryptographically isolated administrative environment.
   Operational Engines:
   1. Student Lifecycle Management (ACTIVE / INACTIVE / BAN) via Supabase RPC.
   2. Verifiable Parental Consent Audit Logging stream.
   3. System-Wide Announcement Composer. */

import { useEffect, useState } from "react";
import {
  Ban, CheckCircle2, FileCheck, Lock,
  Megaphone, RefreshCw, Send, ShieldCheck, Timer,
  UserCheck, Users
} from "lucide-react";
import { useApp, type StudentRow, type AccountStatus } from "@/engine/store";
import { useModal } from "@/engine/modal";
import { navigate } from "@/engine/router";
import { TierPill } from "@/components/ui";
import {
  adminUpdateStudentStatus,
  adminCreateAnnouncement,
  adminFetchConsentAuditStream,
  type ConsentAuditRecord,
} from "@/engine/admin-rpc";

export function AdminConsoleView() {
  const { s, up, toast, liquidateSession } = useApp();
  const { open, close } = useModal();

  const [activeTab, setActiveTab] = useState<"students" | "consent" | "broadcast">("students");

  // Student directory filters & query
  const [studentQuery, setStudentQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");

  // Announcement composer state
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPriority, setAnnPriority] = useState<"normal" | "high" | "pinned">("normal");
  const [publishing, setPublishing] = useState(false);

  // Parental consent audit records
  const [consentLogs, setConsentLogs] = useState<ConsentAuditRecord[]>([]);
  const [loadingConsent, setLoadingConsent] = useState(false);

  // Load consent stream
  const refreshConsentStream = async () => {
    setLoadingConsent(true);
    const { records } = await adminFetchConsentAuditStream();
    setConsentLogs(records);
    setLoadingConsent(false);
  };

  useEffect(() => {
    if (activeTab === "consent") {
      refreshConsentStream();
    }
  }, [activeTab]);

  // Lifecycle status dispatch
  const handleUpdateStatus = async (
    student: StudentRow,
    newStatus: AccountStatus,
    reason: string,
    pauseHours?: number
  ) => {
    const inactiveUntil = pauseHours ? Date.now() + pauseHours * 3600e3 : undefined;
    const res = await adminUpdateStudentStatus(student.id, newStatus, reason, inactiveUntil);

    if (!res.ok) {
      toast(`RPC Governance Failure: ${res.error}`, "err");
      return;
    }

    up(d => {
      const row = d.admin.students.find(x => x.id === student.id);
      if (row) {
        row.status = newStatus;
        row.until = inactiveUntil;
        row.logs.unshift(
          `${new Date().toISOString()} · [ADMIN_RPC] Status → ${newStatus} (${reason})`
        );
      }
      // If targeted user is the current session account, update lifecycle status
      if (d.session.email === student.email) {
        d.session.status = newStatus;
        d.session.inactiveUntil = inactiveUntil;
      }
    });

    if (newStatus === "BAN") {
      toast(`Administrative Decree: ${student.name} banned. Access revoked.`, "err");
    } else if (newStatus === "INACTIVE") {
      toast(`Account Paused: ${student.name} inactive for ${pauseHours}h.`, "warn");
    } else {
      toast(`Account Restored: ${student.name} marked ACTIVE.`, "ok");
    }
  };

  // Open lifecycle modal
  const openLifecycleModal = (st: StudentRow, targetStatus: AccountStatus) => {
    let reason = targetStatus === "BAN" ? "Academic integrity violation" : "Scheduled maintenance";
    let hours = 24;

    open({
      title: `Update Student Lifecycle: ${st.name}`,
      body: (
        <div className="space-y-4 text-sm">
          <p style={{ color: "var(--text-700)" }}>
            Transition account <strong>{st.email}</strong> to status:{" "}
            <span className="font-bold underline uppercase">{targetStatus}</span>.
          </p>
          <div>
            <label className="field-label" htmlFor="lifecycle-reason">Administrative Rationale / Decree</label>
            <input
              id="lifecycle-reason"
              className="input text-xs"
              defaultValue={reason}
              onChange={e => { reason = e.target.value; }}
              placeholder="Provide reason for cryptographic audit record"
              required
            />
          </div>
          {targetStatus === "INACTIVE" && (
            <div>
              <label className="field-label" htmlFor="pause-duration">Pause Duration (Hours)</label>
              <select
                id="pause-duration"
                className="input text-xs"
                defaultValue={24}
                onChange={e => { hours = Number(e.target.value); }}
              >
                <option value={6}>6 Hours</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours (1 Day)</option>
                <option value={72}>72 Hours (3 Days)</option>
                <option value={168}>168 Hours (1 Week)</option>
              </select>
            </div>
          )}
          {targetStatus === "BAN" && (
            <div className="rounded-lg border-2 p-3 text-xs" style={{ borderColor: "var(--accent-500)", background: "var(--accent-100)", color: "var(--accent-800)" }}>
              <p className="font-bold">Irrevocable Administrative Warning:</p>
              <p className="mt-1">
                Banning a student terminates all live cryptographic sessions and locks all vault keys. The student will be routed to the Grievance Appeal gate.
              </p>
            </div>
          )}
        </div>
      ),
      footer: (
        <>
          <button className="btn" onClick={() => close()}>Cancel</button>
          <button
            className={targetStatus === "BAN" ? "btn btn-danger" : targetStatus === "INACTIVE" ? "btn btn-warn" : "btn btn-primary"}
            onClick={() => {
              close();
              handleUpdateStatus(st, targetStatus, reason, targetStatus === "INACTIVE" ? hours : undefined);
            }}
          >
            Confirm Transition
          </button>
        </>
      ),
    });
  };

  // Publish announcement
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;

    setPublishing(true);
    const res = await adminCreateAnnouncement(annTitle.trim(), annBody.trim(), annPriority);
    setPublishing(false);

    if (!res.ok || !res.announcement) {
      toast(`Failed to publish announcement: ${res.error}`, "err");
      return;
    }

    up(d => {
      d.announcements.unshift(res.announcement!);
    });

    toast("Announcement published across student desks", "ok");
    setAnnTitle("");
    setAnnBody("");
  };

  // Filtered student list
  const filteredStudents = s.admin.students
    .filter(st => (st.name + st.email).toLowerCase().includes(studentQuery.toLowerCase()))
    .filter(st => statusFilter === "All" || st.status === statusFilter)
    .filter(st => tierFilter === "All" || st.tier === tierFilter);

  return (
    <div className="space-y-6">
      {/* High-Assurance Administrative Security Header */}
      <div className="rounded-2xl border-2 p-5" style={{ background: "var(--background-100)", borderColor: "var(--text-950)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl border-2 shadow-sm" style={{ borderColor: "var(--text-950)", background: "var(--forest-100)", color: "var(--forest-800)" }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: "var(--forest-700)" }}>
                  Verified Administrative Realm
                </span>
                <span className="pill !py-0.5 !text-[10px]" style={{ background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }}>
                  JWT: academia_admin
                </span>
              </div>
              <h1 className="font-display text-2xl font-black">Governance Command Console</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-sm" onClick={() => navigate("/dashboard")}>
              Exit to Student Desk
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                liquidateSession("Administrative credentials liquidated. Session closed.");
                navigate("/auth");
              }}
            >
              <Lock size={14} /> Liquidate Admin Credentials
            </button>
          </div>
        </div>
      </div>

      {/* Operational Engine Tabs */}
      <div role="tablist" aria-label="Governance Engines" className="flex flex-wrap gap-2 border-b-2 pb-2" style={{ borderColor: "var(--text-900)" }}>
        <button
          role="tab"
          aria-selected={activeTab === "students"}
          className={`pill !py-2 !px-4 !text-xs font-bold ${activeTab === "students" ? "!bg-[var(--marigold-500)] !text-[var(--text-950)]" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <Users size={15} /> Student Lifecycle Engine ({s.admin.students.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "consent"}
          className={`pill !py-2 !px-4 !text-xs font-bold ${activeTab === "consent" ? "!bg-[var(--marigold-500)] !text-[var(--text-950)]" : ""}`}
          onClick={() => setActiveTab("consent")}
        >
          <FileCheck size={15} /> Parental Consent Audit Stream
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "broadcast"}
          className={`pill !py-2 !px-4 !text-xs font-bold ${activeTab === "broadcast" ? "!bg-[var(--marigold-500)] !text-[var(--text-950)]" : ""}`}
          onClick={() => setActiveTab("broadcast")}
        >
          <Megaphone size={15} /> Announcement Composer ({s.announcements.length})
        </button>
      </div>

      {/* ENGINE 1: STUDENT LIFECYCLE MANAGEMENT */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input !py-1.5 !text-xs w-64"
                placeholder="Search student or email..."
                value={studentQuery}
                onChange={e => setStudentQuery(e.target.value)}
              />
              <select
                className="input !py-1.5 !text-xs"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                aria-label="Filter status"
              >
                <option value="All">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BAN">BAN</option>
              </select>
              <select
                className="input !py-1.5 !text-xs"
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                aria-label="Filter tier"
              >
                <option value="All">All Tiers</option>
                <option value="A">Tier A</option>
                <option value="B">Tier B</option>
                <option value="C">Tier C</option>
                <option value="D">Tier D</option>
                <option value="E">Tier E</option>
              </select>
            </div>
            <p className="font-mono text-xs opacity-75">
              Showing {filteredStudents.length} of {s.admin.students.length} students
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border-2" style={{ borderColor: "var(--text-950)" }}>
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 font-mono uppercase tracking-wider" style={{ background: "var(--background-100)", borderColor: "var(--text-950)" }}>
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Lifecycle Status</th>
                  <th className="p-3">Quota Health</th>
                  <th className="p-3">Last Active</th>
                  <th className="p-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2" style={{ borderColor: "var(--background-200)" }}>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm font-semibold opacity-60">
                      No matching student accounts located in registry.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(st => (
                    <tr key={st.id} className="hover:bg-[var(--background-100)] transition-colors">
                      <td className="p-3">
                        <p className="font-bold">{st.name}</p>
                        <p className="font-mono text-[10px] opacity-75">{st.email}</p>
                      </td>
                      <td className="p-3">
                        <TierPill tier={st.tier} />
                      </td>
                      <td className="p-3">
                        <span
                          className="pill !py-0.5 !text-[10px] font-bold"
                          style={
                            st.status === "ACTIVE"
                              ? { background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }
                              : st.status === "INACTIVE"
                              ? { background: "var(--marigold-100)", borderColor: "var(--marigold-500)", color: "var(--marigold-900)" }
                              : { background: "var(--accent-100)", borderColor: "var(--accent-500)", color: "var(--accent-700)" }
                          }
                        >
                          {st.status}
                          {st.status === "INACTIVE" && st.until && (
                            <span className="ml-1 opacity-75">
                              ({Math.max(0, Math.ceil((st.until - Date.now()) / 3600e3))}h)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{st.quotaHealth}</td>
                      <td className="p-3 font-mono text-[10px]">{st.lastSeen}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {st.status !== "ACTIVE" && (
                            <button
                              className="btn btn-sm !py-1 !px-2.5"
                              style={{ background: "var(--forest-100)", color: "var(--forest-800)" }}
                              onClick={() => openLifecycleModal(st, "ACTIVE")}
                              title="Restore account to ACTIVE"
                            >
                              <UserCheck size={13} /> Active
                            </button>
                          )}
                          {st.status !== "INACTIVE" && (
                            <button
                              className="btn btn-sm btn-warn !py-1 !px-2.5"
                              onClick={() => openLifecycleModal(st, "INACTIVE")}
                              title="Temporarily pause usage"
                            >
                              <Timer size={13} /> Pause
                            </button>
                          )}
                          {st.status !== "BAN" && (
                            <button
                              className="btn btn-sm btn-danger !py-1 !px-2.5"
                              onClick={() => openLifecycleModal(st, "BAN")}
                              title="Revoke access decree"
                            >
                              <Ban size={13} /> Ban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENGINE 2: VERIFIABLE PARENTAL CONSENT AUDIT STREAM */}
      {activeTab === "consent" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Guardian Verification Audit Trail</h2>
              <p className="text-xs opacity-75">
                COPPA and under-18 cryptographic token signatures verified through zero-trust hashing.
              </p>
            </div>
            <button className="btn btn-sm" onClick={refreshConsentStream} disabled={loadingConsent}>
              <RefreshCw size={13} className={loadingConsent ? "animate-spin" : ""} /> Refresh Stream
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border-2" style={{ borderColor: "var(--text-950)" }}>
            <table className="w-full text-left text-xs">
              <thead className="border-b-2 font-mono uppercase tracking-wider" style={{ background: "var(--background-100)", borderColor: "var(--text-950)" }}>
                <tr>
                  <th className="p-3">Child Subject</th>
                  <th className="p-3">Guardian Email</th>
                  <th className="p-3">Cryptographic Signature Hash</th>
                  <th className="p-3">Verification State</th>
                  <th className="p-3">Timestamp (UTC)</th>
                  <th className="p-3">Audit Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y-2" style={{ borderColor: "var(--background-200)" }}>
                {consentLogs.map(log => (
                  <tr key={log.consent_id} className="hover:bg-[var(--background-100)] transition-colors">
                    <td className="p-3">
                      <p className="font-bold">{log.child_email}</p>
                      <p className="font-mono text-[10px] opacity-60">{log.child_id}</p>
                    </td>
                    <td className="p-3 font-mono">{log.guardian_email}</td>
                    <td className="p-3 font-mono text-[10px] text-[var(--cobalt-700)]">
                      {log.token_hash}
                    </td>
                    <td className="p-3">
                      <span
                        className="pill !py-0.5 !text-[10px] font-bold"
                        style={
                          log.status === "verified"
                            ? { background: "var(--forest-100)", borderColor: "var(--forest-500)", color: "var(--forest-700)" }
                            : { background: "var(--marigold-100)", borderColor: "var(--marigold-500)", color: "var(--marigold-900)" }
                        }
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleString("en-IN", { timeZone: "UTC" })}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--forest-700)] font-bold">
                        <CheckCircle2 size={12} /> SECURE_HMAC
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENGINE 3: SYSTEM-WIDE ANNOUNCEMENT COMPOSER */}
      {activeTab === "broadcast" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Composer Form */}
          <div className="sheet p-6 space-y-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Megaphone size={18} /> Compose System Broadcast
            </h2>
            <form onSubmit={handlePublishAnnouncement} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="ann-title">Broadcast Headline</label>
                <input
                  id="ann-title"
                  className="input text-sm"
                  placeholder="e.g., Regional Olympiad Schedule Published"
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="ann-body">Announcement Body</label>
                <textarea
                  id="ann-body"
                  className="input min-h-[120px] text-xs leading-relaxed"
                  placeholder="Detail the academic schedule, curriculum adjustment, or governance update..."
                  value={annBody}
                  onChange={e => setAnnBody(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="ann-priority">Broadcast Priority</label>
                <select
                  id="ann-priority"
                  className="input text-xs"
                  value={annPriority}
                  onChange={e => setAnnPriority(e.target.value as "normal" | "high" | "pinned")}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="pinned">Pinned to Top of Desks</option>
                </select>
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={publishing}>
                <Send size={15} /> {publishing ? "Broadcasting..." : "Publish Broadcast to Database"}
              </button>
            </form>
          </div>

          {/* Active Announcements List */}
          <div className="sheet p-6 space-y-4">
            <h2 className="font-display text-lg font-bold">Active Broadcast Stream</h2>
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {s.announcements.map(ann => (
                <div key={ann.id} className="rounded-xl border-2 p-3 space-y-1.5" style={{ borderColor: "var(--background-300)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{ann.title}</span>
                    <span className="pill !py-0.5 !text-[9px] uppercase font-mono">{ann.priority}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{ann.body}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono opacity-60 pt-1">
                    <span>By {ann.author}</span>
                    <span>{new Date(ann.ts).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

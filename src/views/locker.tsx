/* Academia · Phase 3.6 — sealed vault with tamper-lock and .academia-lock re-import */
import { useRef, useState } from "react";
import { Eye, FileKey2, KeyRound, Lock, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useApp, uid, fmtDate, type VaultDoc } from "@/engine/store";
import { useModal } from "@/engine/modal";
import { PageHeader, Pill, SectionHead } from "@/components/ui";

function scrambleOf(name: string): string {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 24; i++) { h = (h * 1103515245 + 12345) >>> 0; out += hex[(h >> 16) & 15]; if (i % 4 === 3 && i < 23) out += "·"; }
  return out;
}

export function TamperAlert({ onReimport }: { onReimport: () => void }) {
  return (
    <div role="alert" className="warn-slide mb-6 flex flex-wrap items-center gap-4 rounded-xl border-2 p-4"
      style={{ borderColor: "var(--accent-600)", background: "var(--accent-100)", boxShadow: "4px 4px 0 var(--accent-600)" }}>
      <ShieldAlert size={28} style={{ color: "var(--accent-600)" }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-black" style={{ color: "var(--accent-600)" }}>TAMPER-LOCK ENGAGED</p>
        <p className="text-sm" style={{ color: "var(--text-700)" }}>Checksum mismatch on the vault keypair. Documents are sealed read-nothing until you re-import a valid <code className="font-mono">.academia-lock</code> file.</p>
      </div>
      <button className="btn btn-danger" onClick={onReimport}><KeyRound size={16} /> Re-import key</button>
    </div>
  );
}

export function LockerView() {
  const { s, up, toast } = useApp();
  const { open, close } = useModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState("");
  const tamper = s.locker.tamper;

  const doImport = (fileName: string) => {
    if (!fileName.endsWith(".academia-lock")) { setImportErr(`“${fileName}” is not a .academia-lock container.`); return; }
    up(d => {
      d.locker.tamper = false;
      d.locker.lastImport = Date.now();
      d.locker.docs = d.locker.docs.map(x => ({ ...x, scrambled: true }));
    });
    close();
    toast("Keypair verified — vault resealed, all documents scrambled", "ok");
  };

  const reimportModal = () => {
    setImportErr("");
    open({
      title: "Re-import .academia-lock",
      body: (
        <div className="space-y-4 text-sm">
          <p style={{ color: "var(--text-700)" }}>Select the key container you exported during provisioning. Verification is local — the file never leaves this device.</p>
          <input ref={fileRef} type="file" accept=".academia-lock" className="input" aria-label="Vault key file"
            onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f.name); }} />
          {importErr && <p className="font-bold" style={{ color: "var(--accent-600)" }}>{importErr}</p>}
          <div className="divider-dashed pt-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-500)" }}>demo keyring</p>
            <button className="btn btn-primary w-full" onClick={() => doImport("aarav.academia-lock")}>
              <FileKey2 size={16} /> Use provisioned key · aarav.academia-lock
            </button>
          </div>
        </div>
      ),
    });
  };

  const preview = (doc: VaultDoc) => {
    if (tamper) { toast("Vault sealed — re-import your key first", "err"); return; }
    open({
      title: doc.name,
      body: (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-bold" style={{ color: "var(--forest-700)" }}><Lock size={15} /> Decrypted in-memory · never written to disk</p>
          <div className="rounded-lg border-2 p-4 font-mono text-xs leading-relaxed" style={{ borderColor: "var(--background-300)", background: "var(--background-50)" }}>
            <p>container: {doc.name}</p>
            <p>type: {doc.kind} · {doc.size}</p>
            <p>cipher: XChaCha20-Poly1305</p>
            <p>checksum: {scrambleOf(doc.name).split("·").join("")}</p>
            <p className="mt-2" style={{ color: "var(--forest-700)" }}>✓ signature matches provisioned keypair</p>
          </div>
          <p style={{ color: "var(--text-500)" }}>This preview renders metadata only in the demo build.</p>
        </div>
      ),
    });
  };

  const removeDoc = (doc: VaultDoc) => {
    up(d => { d.locker.docs = d.locker.docs.filter(x => x.id !== doc.id); });
    toast(`Removed ${doc.kind.toLowerCase()} from vault`, "err", { label: "Undo", fn: () => up(d => { d.locker.docs.unshift(doc); }) });
  };

  return (
    <div>
      <PageHeader kicker="your documents, your keys" title="Locker"
        desc="College application documents sealed into .academia-lock containers. Scrambled at rest, tamper-evident, manually recoverable."
        right={<><Pill tone="cobalt">x25519 keypair</Pill><Pill tone={tamper ? "accent" : "forest"}>{tamper ? "SEALED" : "VERIFIED"}</Pill></>} />

      {tamper && <TamperAlert onReimport={reimportModal} />}

      <div className="mb-5 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={reimportModal}><Upload size={16} /> Import .academia-lock</button>
        <button className="btn" onClick={() => {
          up(d => { d.locker.docs.unshift({ id: uid(), name: `document_${d.locker.docs.length + 1}.academia-lock`, size: "120 KB", kind: "Document", scrambled: true, added: Date.now() }); });
          toast("New document sealed into the vault", "ok");
        }}>+ Seal new document</button>
        <button className="btn" onClick={() => {
          const bad = s.locker.docs.some(d => !d.scrambled);
          if (bad) { up(d => { d.locker.tamper = true; }); toast("Integrity check FAILED — unsealed document found", "err"); }
          else toast(`Integrity check passed · ${s.locker.docs.length} containers verified`, "ok");
        }}>Run integrity check</button>
        {s.locker.lastImport && <span className="self-center font-mono text-[11px]" style={{ color: "var(--text-500)" }}>last key import {fmtDate(s.locker.lastImport)}</span>}
      </div>

      <section className="sheet overflow-hidden">
        <div className="border-b-2 px-5 py-3" style={{ borderColor: "var(--text-900)", background: "var(--background-200)" }}>
          <SectionHead title={`Sealed containers (${s.locker.docs.length})`} right={<span className="font-mono text-[10px]" style={{ color: "var(--text-500)" }}>AES-class cipher · local only</span>} />
        </div>
        <ul>
          {s.locker.docs.map(doc => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 border-b border-dashed px-5 py-4 last:border-0" style={{ borderColor: "var(--background-300)" }}>
              <span className="grid h-11 w-11 flex-none place-items-center rounded-lg border-2" style={{ borderColor: "var(--text-900)", background: doc.scrambled ? "var(--cobalt-100)" : "var(--accent-100)", boxShadow: "2px 2px 0 var(--text-950)" }}>
                <Lock size={18} style={{ color: doc.scrambled ? "var(--cobalt-600)" : "var(--accent-600)" }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] font-semibold">{doc.name}</p>
                <p className="truncate font-mono text-[11px]" style={{ color: doc.scrambled ? "var(--text-500)" : "var(--accent-600)" }}>
                  {doc.scrambled ? `▓ ${scrambleOf(doc.name)}` : "⚠ stored unscrambled — integrity risk"}
                </p>
              </div>
              <span className="pill !text-[10px]">{doc.kind}</span>
              <span className="hidden font-mono text-[11px] sm:block" style={{ color: "var(--text-500)" }}>{doc.size} · {fmtDate(doc.added)}</span>
              <div className="flex gap-1.5">
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Inspect ${doc.name}`} onClick={() => preview(doc)}><Eye size={16} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${doc.name}`} style={{ color: "var(--accent-600)" }} onClick={() => removeDoc(doc)}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-center font-hand text-xl" style={{ color: "var(--text-300)" }}>
        lose the key, lose the vault — export a backup after every rotation
      </p>
    </div>
  );
}
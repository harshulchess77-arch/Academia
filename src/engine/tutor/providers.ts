/* Academia · tutor providers.
   builtin        – deterministic solver, offline, free, private.
   gemini         – Google Gemini API (user's own key).
   openai-compat  – any OpenAI-style /chat/completions endpoint: Groq, OpenRouter, a local Ollama, LM Studio, etc.
   The student's API key is passed per call and never logged, stored in app state, or included in error text. */
import { validateLesson, type Lesson } from "./schema";
import { buildSystemPrompt, buildUserPrompt, type TutorRequest } from "./prompt";
import { looksLikeEquation, solveLinearLesson, SolverInputError } from "./solver";
import { DEMO_LESSON } from "./demo";

export type ProviderId = "builtin" | "gemini" | "openai-compat";
export interface ProviderConfig { id: ProviderId; apiKey?: string; model?: string; baseUrl?: string }
export interface GenOptions { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number }
export interface GenResult { lesson: Lesson; warnings: string[]; source: ProviderId }

export class TutorError extends Error {
  constructor(message: string, public kind: "config" | "auth" | "rate" | "network" | "format" | "unsupported" | "aborted" | "provider" = "provider") { super(message); }
}

export const PRESETS: { label: string; id: ProviderId; baseUrl?: string; model: string; hint: string }[] = [
  { label: "Google Gemini", id: "gemini", model: "gemini-2.5-flash", hint: "Free key from Google AI Studio. Free-tier prompts may be used by Google to improve its products, and Google's terms limit free keys for users in the EEA, UK and Switzerland — use a paid key there." },
  { label: "Groq", id: "openai-compat", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", hint: "OpenAI-compatible. Model names change — pick one from Groq's current list." },
  { label: "OpenRouter", id: "openai-compat", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", hint: "OpenAI-compatible with some free models. Check the model page for current limits." },
  { label: "Local (Ollama)", id: "openai-compat", baseUrl: "http://localhost:11434/v1", model: "llama3.1", hint: "Runs on your own computer: free and private. Start Ollama with OLLAMA_ORIGINS set to this site." },
];

const MAX_IMAGES = 3, MAX_IMAGE_BYTES = 4 * 1024 * 1024, IMG_MIME = ["image/png", "image/jpeg", "image/webp"];

export function validateBaseUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new TutorError("The base URL isn't a valid address.", "config"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new TutorError("The base URL must use https:// (plain http:// is only allowed for localhost).", "config");
  if (u.username || u.password) throw new TutorError("Don't put credentials in the URL — use the API key field.", "config");
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

function checkImages(req: TutorRequest) {
  const imgs = req.images ?? [];
  if (imgs.length > MAX_IMAGES) throw new TutorError(`Attach at most ${MAX_IMAGES} images.`, "config");
  for (const im of imgs) {
    if (!IMG_MIME.includes(im.mime)) throw new TutorError("Images must be PNG, JPEG or WebP.", "config");
    if (!/^[A-Za-z0-9+/=]+$/.test(im.data)) throw new TutorError("Image data is malformed.", "config");
    if (im.data.length * 0.75 > MAX_IMAGE_BYTES) throw new TutorError("An image is larger than 4 MB.", "config");
  }
}

/** Pulls a JSON object out of model text, tolerating code fences and chatter around it. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* fall through to brace scan */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* ignore */ } }
  throw new TutorError("The model didn't return valid JSON.", "format");
}

async function http(f: typeof fetch, url: string, init: RequestInit, opts: GenOptions): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new TutorError("The AI provider took too long to answer.", "network")), opts.timeoutMs ?? 60_000);
  const onAbort = () => ctl.abort(new TutorError("Cancelled.", "aborted"));
  opts.signal?.addEventListener("abort", onAbort);
  try {
    return await f(url, { ...init, signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer" });
  } catch (e) {
    if (ctl.signal.aborted && ctl.signal.reason instanceof TutorError) throw ctl.signal.reason;
    throw new TutorError("Couldn't reach the AI provider. Check your connection, the base URL, and that this site is allowed to call it (CORS / Content-Security-Policy).", "network");
  } finally { clearTimeout(timer); opts.signal?.removeEventListener("abort", onAbort); }
}

function mapStatus(status: number): TutorError {
  if (status === 401 || status === 403) return new TutorError("The provider rejected the API key. Check that it is correct and has access to this model.", "auth");
  if (status === 429) return new TutorError("The provider's rate limit was hit. Wait a minute and try again — free tiers are limited.", "rate");
  if (status === 404) return new TutorError("The provider says that model or address doesn't exist. Check the model name and base URL.", "config");
  return new TutorError(`The provider returned an error (HTTP ${status}).`, "provider");
}

async function callGemini(cfg: ProviderConfig, req: TutorRequest, extra: string, f: typeof fetch, opts: GenOptions): Promise<string> {
  if (!cfg.apiKey) throw new TutorError("Add your Gemini API key in Tutor settings.", "config");
  const model = (cfg.model || "gemini-2.5-flash").replace(/[^A-Za-z0-9._-]/g, "");
  const parts: unknown[] = [{ text: buildUserPrompt(req) + extra }, ...(req.images ?? []).map(i => ({ inlineData: { mimeType: i.mime, data: i.data } }))];
  const res = await http(f, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },   // header, not ?key= (URLs get logged)
    body: JSON.stringify({ systemInstruction: { parts: [{ text: buildSystemPrompt(req) }] }, contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 } }),
  }, opts);
  if (!res.ok) throw mapStatus(res.status);
  const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  if (!text) throw new TutorError("The model returned an empty answer (it may have been blocked by a safety filter). Try rephrasing.", "format");
  return text;
}

async function callOpenAICompat(cfg: ProviderConfig, req: TutorRequest, extra: string, f: typeof fetch, opts: GenOptions): Promise<string> {
  const base = validateBaseUrl(cfg.baseUrl || "");
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(base);
  if (!cfg.apiKey && !isLocal) throw new TutorError("Add your API key in Tutor settings.", "config");
  if (!cfg.model) throw new TutorError("Enter a model name in Tutor settings.", "config");
  const user = (req.images?.length)
    ? [{ type: "text", text: buildUserPrompt(req) + extra }, ...req.images.map(i => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.data}` } }))]
    : buildUserPrompt(req) + extra;
  const send = (json: boolean) => http(f, `${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({ model: cfg.model, temperature: 0.4, max_tokens: 6000, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: buildSystemPrompt(req) }, { role: "user", content: user }] }),
  }, opts);
  let res = await send(true);
  if (res.status === 400) res = await send(false);      // some servers don't support response_format
  if (!res.ok) throw mapStatus(res.status);
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new TutorError("The model returned an empty answer.", "format");
  return text;
}

function builtin(req: TutorRequest): GenResult {
  const t = req.prompt.trim();
  if (req.images?.length) throw new TutorError("The built-in solver can't read photos. Connect an AI provider in Tutor settings to use images.", "unsupported");
  if (looksLikeEquation(t)) {
    try { return { lesson: solveLinearLesson(t), warnings: [], source: "builtin" }; }
    catch (e) { if (e instanceof SolverInputError) throw new TutorError(e.message, "unsupported"); throw e; }
  }
  if (/projectile|kicked ball|thrown ball|parabola|trajectory/i.test(t)) return { lesson: DEMO_LESSON, warnings: [], source: "builtin" };
  throw new TutorError("The built-in tutor (no AI connected) solves one-variable linear equations such as “3x − 4 = 2x + 7” and shows a demo on projectile motion. For any other subject, connect a free AI provider in Tutor settings.", "unsupported");
}

export async function generateLesson(cfg: ProviderConfig, req: TutorRequest, opts: GenOptions = {}): Promise<GenResult> {
  if (!req.prompt.trim() && !req.images?.length) throw new TutorError("Type a question or attach a photo first.", "config");
  checkImages(req);
  if (cfg.id === "builtin") return builtin(req);
  const f = opts.fetchImpl ?? fetch.bind(globalThis);
  const call = cfg.id === "gemini" ? callGemini : callOpenAICompat;

  let extra = "";
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {           // one automatic repair round
    const text = await call(cfg, req, extra, f, opts);
    let raw: unknown;
    try { raw = extractJson(text); } catch (e) { lastErrors = [(e as Error).message]; extra = "\n\nYour previous reply was not valid JSON. Reply with ONE JSON object only."; continue; }
    const v = validateLesson(raw);
    if (v.ok) return { lesson: v.lesson, warnings: v.warnings, source: cfg.id };
    lastErrors = v.errors;
    extra = `\n\nYour previous reply was rejected: ${v.errors.join("; ")}. Fix it and reply with ONE valid JSON object.`;
  }
  throw new TutorError(`The model's answer couldn't be turned into a lesson (${lastErrors.join("; ")}). Try again, or try a different model.`, "format");
}

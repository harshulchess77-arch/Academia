# AI Whiteboard Tutor (`/tutor`)

A tutor that draws every step on a whiteboard. Three modes: **Topic** (explain a concept), **Exam Prep** (turn notes into a
revision walkthrough + quiz) and **Homework** (hints one at a time, never the answer up front). 11 lesson languages.

## How it works

```
 student request ─▶ provider ─▶ Lesson JSON ─▶ validateLesson() ─▶ <Board/> (React SVG)
                      │                              ▲
   built-in solver ───┘   (deterministic, no network) │ every provider's output must pass this gate
```

* A **lesson is data, never code**: ≤24 steps, each with a caption and ≤30 allow-listed shapes
  (`text line arrow rect circle plot table`). `validateLesson()` clamps numbers, caps strings, strips control/bidi characters,
  drops unknown shapes and unparseable plot expressions. Nothing a model returns is executed or injected as HTML.
* **Plots are computed**, not drawn from model-supplied points: the model gives an expression (`2*x - 0.05*x^2`); the app
  samples it with the Numera engine. Poles (`tan`, `1/x`) break the line; out-of-frame values are cut, never clamped.
* **Homework checks are deterministic**: answers are compared numerically (`6`, `x = 6`, `12/2` all match), not by a model.
* **Quiz → Library**: "Save quiz to Library" adds the questions as flashcards (deck `Tutor`) that use the existing SM-2 scheduler.

## Providers (Settings → "Where do lessons come from?")

| Provider | Cost | Subjects | Data leaves device? |
|---|---|---|---|
| **Built-in solver** | free | one-variable linear equations (step-by-step, verified by substitution) + a projectile-motion demo | no |
| **Local (Ollama / LM Studio)** | free | any (quality depends on the model) | no |
| **Google Gemini** (own key) | free tier / paid | any | yes → Google |
| **Groq / OpenRouter / any OpenAI-compatible** (own key) | free tiers / paid | any | yes → that provider |

Keys are held **in memory only** unless the student ticks "Remember on this device"; they are never put in app state, exports,
logs or error messages. Requests go straight from the browser to the provider; Academia's servers never see them.

### Why there is no shared "free" key
Researched Nov 2026 (re-check before launch): Google's free Gemini tier may use prompts to improve its products (human
reviewers can read them) and, per its terms, free keys can't serve end users in the EEA/UK/Switzerland. A shared key serving
students — many of them minors — worldwide would breach those terms and create a privacy problem *for the product*. Bring-your-own
key puts the data terms in the user's own hands; the built-in solver and local models need no third party at all.
**If you later want a hosted free tier:** use a paid provider under a DPA, behind a server-side proxy with per-user
rate limits, moderation, no prompt logging, and regional routing — and have counsel review it for minors.

## Safety
* The system prompt enforces age-appropriate tone, refuses unsafe requests with a gentle redirect, and fences student text
  (`<<<STUDENT>>> … <<<END>>>`) as data to blunt prompt injection. Model output is labelled "AI-drawn — double-check important facts".
* UI warns that if a student is under 18 they should ask a parent or teacher before connecting an AI service.
* CSP `connect-src` allows only: Gemini, Groq, OpenRouter, and `localhost:11434` (Ollama). To use another endpoint, add its origin
  to `index.html` **and** `vercel.json`. Plain `http://` is only accepted for localhost; credentials in URLs are rejected.

## Files
`src/engine/tutor/` — `schema.ts` (format + validator) · `solver.ts` · `providers.ts` · `prompt.ts` · `render.tsx` · `check.ts` · `settings.ts` · `demo.ts`
`src/views/tutor.tsx` · `src/styles/tutor.css` · tests: `src/__tests__/tutor-*.test.ts(x)`

## Known limits / next steps
* The live-model path is covered by mocked-`fetch` tests only (request shape, JSON extraction, repair retry, error mapping); it has
  **not** been run against real Gemini/Groq/OpenRouter endpoints in CI — do a manual pass with a real key before launch.
  Preset model names change; they're editable in settings.
* Built-in solver: linear equations only. Quadratics, systems, calculus steps are good next additions (reuse `math.ts`).
* PDF attachments aren't supported (images PNG/JPEG/WebP ≤4 MB ×3, and .txt/.md ≤200 KB are).
* Tutor UI strings are English constants, not yet in `src/locales/en.json` (lesson *content* is multilingual).
* In-browser models (WebGPU) would give a free, private, any-subject option with no install — not implemented.

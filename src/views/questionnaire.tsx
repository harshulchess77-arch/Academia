/* Academia · Phase 1.3 — letter-scale questionnaire with sticky accuracy gate */
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useApp, type Tier } from "@/engine/store";
import { navigate } from "@/engine/router";
import { cn } from "@/utils/cn";

const QUESTIONS = [
  { id: "tier", prompt: "Where does your current academic standing sit?", options: ["Top 10% — olympiad / competitive track", "Top 25% — advanced coursework", "Middle band — consolidating", "Rebuilding fundamentals", "Exploring — not ranked yet"] },
  { id: "habits", prompt: "What do your study habits actually look like?", options: ["Daily spaced review", "4–5 focused days a week", "Weekend batches", "Right before deadlines", "Whenever inspiration strikes"] },
  { id: "extra", prompt: "How deep are your extracurriculars?", options: ["Competitive — olympiads, debate, nationals", "Club leadership roles", "Regular sports or arts", "Occasional participation", "Haven't started yet"] },
  { id: "coding", prompt: "Your relationship with code?", options: ["I ship projects weekly", "Comfortable scripting", "Curious beginner", "I prefer theory", "No interest in coding"] },
];
const LETTERS = ["A", "B", "C", "D", "E"];

export function QuestionnaireView() {
  const { s, up, toast } = useApp();
  const answers = s.questionnaire.answers;
  const ack = s.questionnaire.ack;
  const answered = QUESTIONS.filter(q => answers[q.id]).length;
  const complete = answered === QUESTIONS.length && ack;

  const pick = (qid: string, letter: string) => {
    up(d => {
      d.questionnaire.answers[qid] = letter;
      if (qid === "coding") d.questionnaire.sandboxEnabled = ["A", "B", "C"].includes(letter);
      if (qid === "tier") d.session.tier = letter as Tier;
    });
  };

  return (
    <div className="min-h-screen pb-16">
      {/* sticky accuracy warning */}
      <div className="sticky top-0 z-40 border-b-2 px-4 py-3" style={{ background: "var(--marigold-100)", borderColor: "var(--text-900)" }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <AlertTriangle size={20} style={{ color: "var(--marigold-900)" }} aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-semibold" style={{ color: "var(--marigold-900)" }}>
            Answer accurately. Your letter scale calibrates tiers, quotas and the milestone predictor — inflated answers mis-route every module.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="checkbox" checked={ack} onChange={e => up(d => { d.questionnaire.ack = e.target.checked; })} />
            accuracy_warning_acknowledged
          </label>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="ruled-margin sheet px-6 py-8 md:px-14">
          <p className="font-hand text-2xl" style={{ color: "var(--accent-500)" }}>intake sheet · {answered}/4 answered</p>
          <h1 className="font-display text-3xl font-black md:text-4xl">The letter-scale questionnaire</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-500)" }}>
            {!ack ? "Choices unlock once you acknowledge the accuracy warning above." : "Pick one letter per question. You can revise answers before provisioning."}
          </p>
          <div className="gantt-track mt-4" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={4} aria-label="Questionnaire progress">
            <div className="gantt-bar" style={{ width: `${(answered / 4) * 100}%`, background: "var(--forest-500)" }} />
          </div>

          <div className="mt-8 space-y-9">
            {QUESTIONS.map((q, qi) => (
              <fieldset key={q.id}>
                <legend className="mb-3 font-display text-lg font-bold">
                  <span className="mr-2 font-mono text-sm" style={{ color: "var(--cobalt-500)" }}>Q{qi + 1}.</span>{q.prompt}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {q.options.map((opt, oi) => {
                    const letter = LETTERS[oi];
                    const selected = answers[q.id] === letter;
                    return (
                      <button key={letter} type="button" disabled={!ack} aria-pressed={selected}
                        className={cn("letter-opt", selected && "selected", oi === 4 && "sm:col-span-2")}
                        onClick={() => pick(q.id, letter)}>
                        <span className="letter-key">{letter}</span>
                        <span className="pt-1 font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {q.id === "coding" && answers.coding && (
                  <p className="mt-2 font-mono text-xs" style={{ color: "var(--text-500)" }}>
                    sandbox_enabled = {String(s.questionnaire.sandboxEnabled)}
                  </p>
                )}
              </fieldset>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed pt-6" style={{ borderColor: "var(--background-300)" }}>
            <p className="font-mono text-xs" style={{ color: "var(--text-500)" }}>scale: {QUESTIONS.map(q => answers[q.id] ?? "·").join(" · ")}</p>
            <button className="btn btn-primary" disabled={!complete}
              onClick={() => {
                up(d => { d.session.stage = "provisioning"; d.session.provisionStart = Date.now(); });
                toast("Intake locked — provisioning started", "info");
                navigate("/provisioning");
              }}>
              Lock answers & provision <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
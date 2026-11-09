/* Original hand-authored demo lesson (no model involved) so the whiteboard works the moment the page opens. */
import { validateLesson, type Lesson } from "./schema";

const raw = {
  title: "Why a kicked ball curves: projectile motion",
  lang: "en",
  steps: [
    { say: "A ball is kicked at an angle. Two things happen at once: it keeps moving forward, and gravity pulls it down.", board: [
      { t: "line", x1: 5, y1: 85, x2: 95, y2: 85, color: "ink" }, { t: "circle", x: 12, y: 80, r: 2.2, color: "vermillion", fill: true }, { t: "arrow", x1: 12, y1: 80, x2: 30, y2: 58, color: "cobalt" }, { t: "text", x: 31, y: 56, s: "launch velocity", size: 22, color: "cobalt" }] },
    { say: "Split the launch velocity into a sideways part and an upward part. They don't affect each other.", board: [
      { t: "arrow", x1: 12, y1: 80, x2: 34, y2: 80, color: "forest" }, { t: "text", x: 22, y: 90, s: "sideways: constant", size: 22, color: "forest" }, { t: "arrow", x1: 12, y1: 80, x2: 12, y2: 58, color: "marigold" }, { t: "text", x: 2, y: 54, s: "upward: slows down", size: 22, color: "marigold" }] },
    { say: "Sideways, nothing slows the ball (ignoring air), so equal distances are covered in equal times. Upward, gravity steals speed until the ball stops rising at the top.", clear: true, board: [
      { t: "line", x1: 5, y1: 85, x2: 95, y2: 85, color: "ink" }, { t: "table", x: 10, y: 15, rows: [["time (s)", "sideways (m)", "height (m)"], ["0", "0", "0"], ["1", "10", "15"], ["2", "20", "20"], ["3", "30", "15"], ["4", "40", "0"]], color: "ink" }], check: { question: "At which second is the ball highest?", answer: "2", hints: ["Look for the biggest height in the table.", "The rise and fall are symmetric around the top."] } },
    { say: "Plot the height against the sideways distance and you get a parabola: height = 2x − 0.05x². The curve is just the two independent motions combined.", clear: true, board: [
      { t: "plot", x: 15, y: 10, w: 70, h: 70, fn: "2*x - 0.05*x^2", xmin: 0, xmax: 40, ymin: 0, ymax: 22, color: "vermillion" }, { t: "text", x: 40, y: 92, s: "height = 2x − 0.05x²", size: 26, color: "ink" }] },
  ],
  quiz: [
    { q: "Ignoring air, what happens to the ball's sideways speed during the flight?", options: ["It increases", "It stays the same", "It decreases to zero", "It reverses"], answer: 1, why: "Nothing pushes or pulls sideways, so the sideways speed is constant." },
    { q: "What shape is the path of a projectile?", options: ["Straight line", "Circle", "Parabola", "Spiral"], answer: 2, why: "Constant sideways speed plus constant downward acceleration gives a parabola." },
  ],
  notes: ["Sideways and vertical motion are independent.", "Gravity changes only the vertical speed.", "Combine them and the path is a parabola."],
};

const v = validateLesson(raw);
if (!v.ok) throw new Error(`demo lesson invalid: ${v.errors.join("; ")}`);
export const DEMO_LESSON: Lesson = v.lesson;

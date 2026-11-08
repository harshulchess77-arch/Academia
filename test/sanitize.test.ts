// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/engine/sanitize";

describe("notebook HTML sanitizer", () => {
  it("keeps allowed formatting tags", () => {
    expect(sanitizeHtml("<p>Hello <b>bold</b> and <i>italic</i></p><ul><li>one</li></ul>"))
      .toBe("<p>Hello <b>bold</b> and <i>italic</i></p><ul><li>one</li></ul>");
  });

  it("strips all attributes, including event handlers", () => {
    expect(sanitizeHtml('<b onclick="alert(1)" style="color:red">x</b>')).toBe("<b>x</b>");
    expect(sanitizeHtml('<p class="a" id="b">t</p>')).toBe("<p>t</p>");
  });

  it("removes script elements and their contents", () => {
    expect(sanitizeHtml('<p>ok</p><script>alert("xss")</script>')).toBe("<p>ok</p>");
    expect(sanitizeHtml('<div>a<script>b</script>c</div>')).toBe("<div>ac</div>");
  });

  it("neutralizes img onerror payloads", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><p>after</p>');
    expect(out).not.toContain("img");
    expect(out).not.toContain("onerror");
    expect(out).toContain("after");
  });

  it("drops active/embed elements entirely", () => {
    for (const tag of ["iframe", "object", "embed", "svg", "math", "style", "link", "meta", "form", "input"]) {
      const out = sanitizeHtml(`<${tag} src="https://evil.example"></${tag}>safe`);
      expect(out.toLowerCase()).not.toContain(tag);
      expect(out).toContain("safe");
    }
  });

  it("unwraps disallowed but harmless tags, keeping text", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe("click");
    expect(sanitizeHtml('<custom-el><b>kept</b></custom-el>')).toBe("<b>kept</b>");
    expect(sanitizeHtml('<font color="red">old</font>')).toBe("old");
  });

  it("handles deeply nested hostile markup", () => {
    const evil = '<div><p><img src=x onerror=alert(1)><svg><script>alert(2)</script></svg><b>fine</b></p></div>';
    const out = sanitizeHtml(evil);
    expect(out).not.toMatch(/onerror|script|svg|img/i);
    expect(out).toContain("<b>fine</b>");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

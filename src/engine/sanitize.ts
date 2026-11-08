/* Academia · allow-list HTML sanitizer for the typed notebook.
   The scratchpad persists innerHTML; without sanitizing on save AND on
   load, pasted markup like <img onerror=…> became stored XSS on every
   later visit. Only formatting tags survive — no attributes, no active
   elements. */

const ALLOWED = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP",
  "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "DIV", "SPAN", "HR",
]);
/* removed entirely, children included */
const DROP = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "APPLET", "LINK", "META",
  "BASE", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "SVG", "MATH",
  "TEMPLATE", "NOSCRIPT", "FRAME", "FRAMESET", "AUDIO", "VIDEO", "SOURCE",
]);

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.nodeValue ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag)) return null;
  const kids: Node[] = [];
  for (const child of [...el.childNodes]) {
    const k = cleanNode(child, doc);
    if (k) kids.push(k);
  }
  if (!ALLOWED.has(tag)) {
    // unknown tag → unwrap, keep its clean children
    const frag = doc.createDocumentFragment();
    kids.forEach(k => frag.appendChild(k));
    return frag;
  }
  const out = doc.createElement(tag.toLowerCase());
  kids.forEach(k => out.appendChild(k));
  return out;
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const frag = doc.createDocumentFragment();
  for (const child of [...doc.body.childNodes]) {
    const k = cleanNode(child, doc);
    if (k) frag.appendChild(k);
  }
  const wrap = doc.createElement("div");
  wrap.appendChild(frag);
  return wrap.innerHTML;
}

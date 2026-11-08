/* Academia · card-render.tsx
   Safe card face renderer supporting Markdown-lite and inline math markers.
   - Outputs React elements ONLY (never dangerouslySetInnerHTML).
   - Inline math $...$ is parsed and displayed as formatted plain-text math tokens.
     NOTE: Numera's parser evaluates expressions; it does NOT typeset LaTeX.
     Therefore $...$ displays cleanly formatted monospace/italic tokens, not KaTeX.
   - Literal dollar signs like "$100" or "$ 50" are handled as normal text.
*/

import React from "react";

interface CardRendererProps {
  text: string;
  className?: string;
}

export function CardFaceContent({ text, className }: CardRendererProps): React.ReactElement {
  if (!text) return <span className={className}></span>;

  // Split lines first
  const lines = text.split("\n");

  return (
    <div className={className}>
      {lines.map((line, lineIdx) => (
        <React.Fragment key={lineIdx}>
          {renderLineSegments(line)}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Render a single line with math, bold, italic, code */
function renderLineSegments(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  // Match inline math: $...$ where $ is not immediately followed or preceded by space, or currency $123
  // Currency pattern: \$[0-9] (should stay literal)
  // Math pattern: \$([^$\n]+?)\$
  const mathRegex = /(^|[^\\])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(line)) !== null) {
    const prefix = match[1]; // non-backslash char before $
    const mathContent = match[2];
    const matchStart = match.index + prefix.length;

    // Push text before the math block
    if (match.index > lastIndex) {
      nodes.push(...renderFormattedText(line.slice(lastIndex, match.index)));
    }
    if (prefix) {
      nodes.push(...renderFormattedText(prefix));
    }

    // Check if this looks like currency or invalid math, e.g. "$100 and $200"
    if (/^\d+(?:\.\d+)?$/.test(mathContent)) {
      // It's pure numbers like $50 — treat as literal
      nodes.push(`$${mathContent}$`);
    } else {
      // Formatted plain-text math container
      nodes.push(
        <span
          key={`math-${matchStart}`}
          className="mx-1 inline-block rounded border border-dashed px-1.5 py-0.5 font-mono text-xs font-semibold"
          style={{ borderColor: "var(--cobalt-500)", background: "var(--cobalt-100)", color: "var(--cobalt-600)" }}
          title="Inline mathematical expression (Numera plain-text representation)"
        >
          {mathContent}
        </span>
      );
    }

    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(...renderFormattedText(line.slice(lastIndex)));
  }

  return nodes;
}

/** Render Markdown-lite: **bold**, *italic*, `code` */
function renderFormattedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Tokenize code, bold, italic
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const token = m[0];
    const key = `fmt-${m.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={key} className="rounded px-1 py-0.5 font-mono text-xs" style={{ background: "var(--background-200)" }}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={key} className="font-bold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }

    last = tokenRegex.lastIndex;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts;
}

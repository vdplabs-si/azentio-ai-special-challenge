import type { ReactNode } from "react";

/**
 * Renders an article body as text-only blocks. A tiny subset of Markdown is recognised
 * (## / ### headings, "- " or "* " bullet lists, blank-line paragraphs). Nothing is ever
 * interpreted as HTML, so stored content cannot inject markup or scripts.
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: ReactNode[] = [];

  blocks.forEach((block, i) => {
    const lines = block.split("\n");
    if (/^###\s+/.test(block) && lines.length === 1) {
      out.push(
        <h3 key={i} className="mt-4 text-xl font-semibold text-brand-ink">
          {block.replace(/^###\s+/, "")}
        </h3>,
      );
    } else if (/^##?\s+/.test(block) && lines.length === 1) {
      out.push(
        <h2 key={i} className="mt-6 text-2xl font-semibold text-brand-ink">
          {block.replace(/^##?\s+/, "")}
        </h2>,
      );
    } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push(
        <ul key={i} className="flex list-disc flex-col gap-2 pl-6 marker:text-success">
          {lines.map((l, j) => (
            <li key={j}>{l.replace(/^\s*[-*]\s+/, "")}</li>
          ))}
        </ul>,
      );
    } else {
      out.push(
        <p key={i} className="whitespace-pre-line">
          {block}
        </p>,
      );
    }
  });

  return <div className="flex flex-col gap-5 text-base leading-relaxed text-brand-ink sm:text-lg">{out}</div>;
}

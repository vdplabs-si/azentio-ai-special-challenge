"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface Citation {
  ref: string;
  id: string;
  title: string;
  kind: "shared_observation" | "content";
  href: string;
}
interface Answer {
  answer: string;
  citations: Citation[];
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
  retrieval: { shared: number; content: number; keywordMatched: boolean; terms: string[] };
}

const MAX = 1000;

/** Renders the answer as plain text, turning valid [S#] markers into links to their sources. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  const parts = text.split(/(\[S\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">
      {parts.map((part, i) => {
        const m = /^\[(S\d+)\]$/.exec(part);
        const c = m ? byRef.get(m[1]!) : undefined;
        if (!c) return <Fragment key={i}>{part}</Fragment>;
        return (
          <Link
            key={i}
            href={c.href}
            title={c.title}
            className="mx-0.5 inline-flex items-center rounded bg-brand-light px-1 align-baseline text-xs font-semibold text-brand-navy ring-1 ring-brand-navy/20 hover:bg-brand-green/20"
          >
            {c.ref}
          </Link>
        );
      })}
    </p>
  );
}

function retrievalNote(r: Answer["retrieval"]) {
  const shared = `${r.shared} approved contribution${r.shared === 1 ? "" : "s"}`;
  const content = `${r.content} content item${r.content === 1 ? "" : "s"}`;
  if (!r.keywordMatched)
    return `Retrieved ${shared} and ${content}. No contribution matched your keywords, so the most recent approved contributions were used and may not be relevant.`;
  return `Retrieved ${shared} and ${content}${r.terms.length ? ` matching: ${r.terms.join(", ")}` : ""}.`;
}

export function AiraAssistant({ model }: { model: string | null }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(Answer & { question: string }) | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 5) {
      setError("Ask a question of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<Answer>("/api/v1/aira", { body: { question: q } });
      setResult({ ...res, question: q });
    } catch (err) {
      const field = err instanceof ApiError ? err.fieldErrors.question?.[0] : undefined;
      const msg = field ?? errorMessage(err);
      setError(msg);
      if (!(err instanceof ApiError) || err.status >= 500) toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={ask} className="grid gap-3 rounded-lg border bg-card p-4" aria-busy={busy}>
        <Label htmlFor="aira-question">Your question</Label>
        <Textarea
          id="aira-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX))}
          rows={3}
          maxLength={MAX}
          placeholder="e.g. What have participants observed about SME working-capital stress?"
          aria-invalid={!!error}
          aria-describedby="aira-question-hint"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id="aira-question-hint" className="text-xs text-muted-foreground">
            {question.length}/{MAX} · up to 10 questions per minute{model ? ` · model ${model}` : ""}
          </p>
          <Button type="submit" disabled={busy || question.trim().length < 5}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {busy ? "Synthesising…" : "Ask AIRA"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section aria-label="AIRA answer" aria-live="polite" className="grid gap-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-auto whitespace-normal border-warning/50 text-warning">
              AI-generated synthesis of approved contributions — verify before use
            </Badge>
            <span className="text-xs text-muted-foreground">Model: {result.model}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-brand-ink">Question:</span> {result.question}
          </p>
          <AnswerText text={result.answer} citations={result.citations} />
          <div className="grid gap-2 border-t pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cited sources</h3>
            {result.citations.length === 0 ? (
              <p className="text-sm text-muted-foreground">The answer did not cite any retrieved source. Treat it as unsupported.</p>
            ) : (
              <ol className="grid gap-1.5">
                {result.citations.map((c) => (
                  <li key={c.ref} className="flex flex-wrap items-start gap-2 text-sm">
                    <span className="mt-0.5 rounded bg-brand-light px-1 text-xs font-semibold text-brand-navy">{c.ref}</span>
                    <Link href={c.href} className="text-brand-navy hover:underline">
                      {c.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{c.kind === "shared_observation" ? "Shared contribution" : "Published content"}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted-foreground">
              {retrievalNote(result.retrieval)}
              {result.usage.totalTokens !== null ? ` ${result.usage.totalTokens} tokens used.` : ""}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { LIMITS, normaliseTopic, topicSchema } from "@/server/learning/schemas";
import { Input } from "@/components/ui/input";

/** Tag input for lowercase topics (0–8 tags, 2–40 chars). Validates with the shared zod schema. */
export function TopicInput({
  value,
  onChange,
  id,
  invalid,
  max = LIMITS.topicsMax,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  invalid?: boolean;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  function add(raw: string) {
    const t = normaliseTopic(raw.replace(/,$/, ""));
    if (!t) return;
    const parsed = topicSchema.safeParse(t);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid topic.");
    if (value.includes(parsed.data)) return setError("That topic is already added.");
    if (value.length >= max) return setError(`Add at most ${max} topics.`);
    setError(null);
    onChange([...value, parsed.data]);
    setDraft("");
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected topics">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2.5 pr-1 text-xs text-brand-ink">
              {t}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-brand-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onChange(value.filter((x) => x !== t))}
                aria-label={`Remove topic ${t}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        aria-invalid={invalid || Boolean(error) || undefined}
        aria-describedby={hintId}
        placeholder={value.length >= max ? "Topic limit reached" : "Type a topic and press Enter"}
        disabled={value.length >= max}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.endsWith(",")) add(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <p id={hintId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {error ?? `${value.length}/${max} topics · lowercase, ${LIMITS.topicMin}–${LIMITS.topicMax} characters each`}
      </p>
    </div>
  );
}

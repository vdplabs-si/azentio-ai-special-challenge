"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { activeMentionQuery, mentionToken } from "@/components/portal/collab/mention-tokens";
import { PersonAvatar } from "@/components/portal/collab/ui";

export interface MentionPerson {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Textarea with an @mention picker. Typing "@" + letters suggests people who can view the
 * parent resource; choosing one inserts a `@[Name](id)` token. The server re-validates every
 * mention, so the list is a convenience only.
 */
export function MentionTextarea({
  id,
  value,
  onChange,
  people,
  placeholder,
  rows = 3,
  disabled,
  invalid,
  maxLength,
  onSubmitShortcut,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  people: MentionPerson[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  invalid?: boolean;
  maxLength?: number;
  /** Ctrl/Cmd+Enter */
  onSubmitShortcut?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = mention
    ? people
        .filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];
  const open = matches.length > 0;

  function update(next: string, caret: number) {
    onChange(next);
    setMention(activeMentionQuery(next, caret));
    setHighlight(0);
  }

  function choose(p: MentionPerson) {
    const el = ref.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? value.length;
    const token = `${mentionToken(p.name, p.id)} `;
    const next = value.slice(0, mention.start) + token + value.slice(caret);
    onChange(next);
    setMention(null);
    const pos = mention.start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(matches[highlight] ?? matches[0]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmitShortcut) {
      e.preventDefault();
      onSubmitShortcut();
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onChange={(e) => update(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        className="min-h-20"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention someone"
          className="absolute left-0 z-50 mt-1 max-h-60 w-full max-w-sm overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {matches.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", i === highlight && "bg-accent")}
            >
              <PersonAvatar name={p.name} image={p.image} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Type @ to mention someone who can see this project.</p>
    </div>
  );
}

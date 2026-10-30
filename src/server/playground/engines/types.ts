/**
 * Shared contracts for Playground engines. Engines are pure, deterministic functions over
 * SYNTHETIC inputs — no I/O, no clock, no Math.random — so the same inputs always produce
 * the same outputs and every result can be reproduced from its stored inputs.
 */
import { z } from "zod";
import type { EngineKey } from "./keys";

export type InputValue = number | string;
export type InputValues = Record<string, InputValue>;

export interface NumberFieldDescriptor {
  key: string;
  label: string;
  kind: "number";
  min: number;
  max: number;
  step: number;
  unit?: string;
  help?: string;
}

export interface SelectFieldDescriptor {
  key: string;
  label: string;
  kind: "select";
  options: { value: string; label: string }[];
  help?: string;
}

export type FieldDescriptor = NumberFieldDescriptor | SelectFieldDescriptor;

export type ValueFormat = "number" | "integer" | "percent" | "amount" | "ratio" | "text";

export interface Metric {
  key: string;
  label: string;
  value: number | string;
  /** Comparison value (baseline policy, portfolio average, naive figure…). */
  before?: number | string;
  beforeLabel?: string;
  format: ValueFormat;
  /** Suffix for `number` values, e.g. "pp". */
  unit?: string;
  /** Direction that is favourable, used only to colour the change. */
  better?: "higher" | "lower";
  hint?: string;
}

export interface ResultColumn {
  key: string;
  label: string;
  format?: ValueFormat;
  unit?: string;
}

export type CellValue = string | number | boolean | null;

export interface ResultTable {
  title: string;
  columns: ResultColumn[];
  data: Record<string, CellValue>[];
  emptyMessage?: string;
}

export interface EngineResult {
  summary: string;
  metrics: Metric[];
  rows: ResultTable;
  explanation: string[];
  evidence: string[];
}

export interface EngineDefinition<S extends z.ZodType<InputValues>> {
  key: EngineKey;
  name: string;
  inputSchema: S;
  fields: FieldDescriptor[];
  run(inputs: z.infer<S>): EngineResult;
}

// ── Input helpers: one definition drives both the zod bounds and the UI descriptor ──

interface FieldSpec<T extends z.ZodType> {
  schema: T;
  field: Omit<NumberFieldDescriptor, "key"> | Omit<SelectFieldDescriptor, "key">;
}

export function numberInput(d: { label: string; min: number; max: number; step: number; int?: boolean; unit?: string; help?: string }) {
  let schema = z
    .number({ error: `${d.label} must be a number.` })
    .min(d.min, `${d.label} must be at least ${d.min}.`)
    .max(d.max, `${d.label} must be at most ${d.max}.`);
  if (d.int) schema = schema.int(`${d.label} must be a whole number.`);
  const field: Omit<NumberFieldDescriptor, "key"> = {
    label: d.label,
    kind: "number",
    min: d.min,
    max: d.max,
    step: d.step,
    ...(d.unit ? { unit: d.unit } : {}),
    ...(d.help ? { help: d.help } : {}),
  };
  return { schema, field } satisfies FieldSpec<z.ZodNumber>;
}

export function selectInput<const V extends string>(d: {
  label: string;
  options: readonly { value: V; label: string }[];
  help?: string;
}) {
  const values = d.options.map((o) => o.value) as [V, ...V[]];
  const schema = z.enum(values, { error: `Choose a valid ${d.label.toLowerCase()}.` });
  const field: Omit<SelectFieldDescriptor, "key"> = {
    label: d.label,
    kind: "select",
    options: d.options.map((o) => ({ value: o.value, label: o.label })),
    ...(d.help ? { help: d.help } : {}),
  };
  return { schema, field };
}

/** Build a strict zod object and UI field list from one keyed spec (keys can never drift). */
export function defineInputs<T extends Record<string, { schema: z.ZodType; field: FieldSpec<z.ZodType>["field"] }>>(spec: T) {
  const shape = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, v.schema])) as { [K in keyof T]: T[K]["schema"] };
  const fields = Object.entries(spec).map(([key, v]) => ({ ...v.field, key }) as FieldDescriptor);
  return { schema: z.strictObject(shape), fields };
}

// ── Stored-result guard (run outputs are JSON in the database) ──

export function isEngineResult(value: unknown): value is EngineResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<EngineResult>;
  return (
    typeof v.summary === "string" &&
    Array.isArray(v.metrics) &&
    Array.isArray(v.explanation) &&
    Array.isArray(v.evidence) &&
    !!v.rows &&
    typeof v.rows === "object" &&
    Array.isArray(v.rows.columns) &&
    Array.isArray(v.rows.data)
  );
}

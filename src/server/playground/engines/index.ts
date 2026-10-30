/**
 * Engine registry: maps PlaygroundScenario.engine keys to deterministic engines.
 * Unknown keys resolve to null so callers fail closed instead of crashing.
 */
import type { z } from "zod";
import { ENGINE_KEYS, type EngineKey } from "./keys";
import type { EngineDefinition, EngineResult, FieldDescriptor, InputValues } from "./types";
import { engine as creditStrategy } from "./credit-strategy-simulator";
import { engine as smeCredit } from "./sme-credit-decisioning";
import { engine as similarPortfolio } from "./similar-portfolio-intelligence";
import { engine as riva } from "./riva";
import { engine as seasonality } from "./financial-analysis-intelligence";

export interface RegisteredEngine {
  key: EngineKey;
  name: string;
  fields: FieldDescriptor[];
  /** Validate raw inputs; throws ZodError (→ 422 with per-field messages). */
  parse(raw: unknown): InputValues;
  safeParse(raw: unknown): { success: true; data: InputValues } | { success: false; error: z.ZodError };
  /** Validate and run. */
  run(raw: unknown): EngineResult;
}

function register<S extends z.ZodType<InputValues>>(e: EngineDefinition<S>): RegisteredEngine {
  return {
    key: e.key,
    name: e.name,
    fields: e.fields,
    parse: (raw) => e.inputSchema.parse(raw),
    safeParse: (raw) => {
      const r = e.inputSchema.safeParse(raw);
      return r.success ? { success: true, data: r.data } : { success: false, error: r.error };
    },
    run: (raw) => e.run(e.inputSchema.parse(raw)),
  };
}

const REGISTRY: Record<EngineKey, RegisteredEngine> = {
  "credit-strategy-simulator": register(creditStrategy),
  "sme-credit-decisioning": register(smeCredit),
  "similar-portfolio-intelligence": register(similarPortfolio),
  riva: register(riva),
  "financial-analysis-intelligence": register(seasonality),
};

export const isEngineKey = (key: string): key is EngineKey => (ENGINE_KEYS as readonly string[]).includes(key);

export function getEngine(key: string): RegisteredEngine | null {
  return isEngineKey(key) ? REGISTRY[key] : null;
}

export { ENGINE_KEYS, type EngineKey };

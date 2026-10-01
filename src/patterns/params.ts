import type { PatternTemplate } from "./types.js";

export function resolveParams(template: PatternTemplate, raw: Record<string, number>): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const [key, spec] of Object.entries(template.parameters)) {
    const value = raw[key];
    const finite = typeof value === "number" && Number.isFinite(value) ? value : spec.default;
    const clamped = Math.min(spec.max, Math.max(spec.min, finite));
    resolved[key] = spec.integer ? Math.round(clamped) : clamped;
  }
  return resolved;
}

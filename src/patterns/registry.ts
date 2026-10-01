import { sashPattern } from "./sash.js";
import { solidPattern } from "./solid.js";
import { stripesPattern } from "./stripes.js";
import type { PatternTemplate } from "./types.js";

const TEMPLATES: readonly PatternTemplate[] = [solidPattern, stripesPattern, sashPattern];

export function listPatternTemplates(): readonly PatternTemplate[] {
  return TEMPLATES;
}

export function getPatternTemplate(id: string): PatternTemplate {
  const template = TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown pattern "${id}". Known patterns: ${TEMPLATES.map((candidate) => candidate.id).join(", ")}`);
  return template;
}

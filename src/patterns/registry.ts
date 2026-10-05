import { centerBandPattern } from "./center-band.js";
import { checkersPattern } from "./checkers.js";
import { chestBandPattern } from "./chest-band.js";
import { chevronPattern } from "./chevron.js";
import { diagonalPattern } from "./diagonal.js";
import { gradientPattern } from "./gradient.js";
import { halvesPattern } from "./halves.js";
import { hoopsPattern } from "./hoops.js";
import { pinstripesPattern } from "./pinstripes.js";
import { sashPattern } from "./sash.js";
import { solidPattern } from "./solid.js";
import { stripesPattern } from "./stripes.js";
import type { PatternTemplate } from "./types.js";

// Padrão novo entra no fim: a ordem participa do sorteio ponderado e reordenar muda os kits de uma seed.
const TEMPLATES: readonly PatternTemplate[] = [
  solidPattern,
  stripesPattern,
  sashPattern,
  pinstripesPattern,
  hoopsPattern,
  diagonalPattern,
  chevronPattern,
  chestBandPattern,
  centerBandPattern,
  checkersPattern,
  halvesPattern,
  gradientPattern,
];

export function listPatternTemplates(): readonly PatternTemplate[] {
  return TEMPLATES;
}

export function getPatternTemplate(id: string): PatternTemplate {
  const template = TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown pattern "${id}". Known patterns: ${TEMPLATES.map((candidate) => candidate.id).join(", ")}`);
  return template;
}

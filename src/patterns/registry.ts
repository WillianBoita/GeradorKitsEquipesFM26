import { centerBandPattern } from "./center-band.js";
import { checkersPattern } from "./checkers.js";
import { chestBandPattern } from "./chest-band.js";
import { chevronPattern } from "./chevron.js";
import { diagonalPattern } from "./diagonal.js";
import { doublePinlinePattern } from "./double-pinline.js";
import { gradientDiagonalPattern } from "./gradient-diagonal.js";
import { gradientRadialPattern } from "./gradient-radial.js";
import { gradientPattern } from "./gradient.js";
import { halvesPattern } from "./halves.js";
import { hoopLinePattern, shoulderLinePattern } from "./horizontal-lines.js";
import { hoopsPattern } from "./hoops.js";
import { pinstripesPattern } from "./pinstripes.js";
import { sashPattern } from "./sash.js";
import { sideLinesPattern } from "./side-lines.js";
import { solidPattern } from "./solid.js";
import { stripesPattern } from "./stripes.js";
import { torsoCirclePattern, torsoCrossPattern, torsoDiamondPattern, torsoTrianglePattern } from "./torso-shapes.js";
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
  sideLinesPattern,
  doublePinlinePattern,
  shoulderLinePattern,
  hoopLinePattern,
  torsoCirclePattern,
  torsoDiamondPattern,
  torsoTrianglePattern,
  torsoCrossPattern,
  gradientDiagonalPattern,
  gradientRadialPattern,
];

export function listPatternTemplates(): readonly PatternTemplate[] {
  return TEMPLATES;
}

export function listLayerTemplates(): PatternTemplate[] {
  return TEMPLATES.filter((template) => template.layerSlot !== undefined);
}

export function getPatternTemplate(id: string): PatternTemplate {
  const template = TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown pattern "${id}". Known patterns: ${TEMPLATES.map((candidate) => candidate.id).join(", ")}`);
  return template;
}

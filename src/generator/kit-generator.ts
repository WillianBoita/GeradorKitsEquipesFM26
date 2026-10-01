import type { ClubIdentity } from "../core/club.js";
import { COLLAR_STYLES, SLEEVE_STYLES, type ColorRole, type KitDefinition } from "../core/kit.js";
import { resolvePalette } from "../core/palette.js";
import { createRng, type Rng } from "../core/random.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

const TRIM_ROLES: readonly ColorRole[] = ["secondary", "accent"];
const SHORTS_ROLES: readonly ColorRole[] = ["primary", "secondary"];

export function generateKit(identity: ClubIdentity, seed: number): KitDefinition {
  const rng = createRng(seed);
  // A ordem das chamadas ao rng faz parte do contrato de reprodutibilidade: reordenar muda os kits gerados para a mesma seed.
  const colors = resolvePalette(identity.palette, rng);
  const template = pickPattern(identity, rng);
  const params = randomParams(template, rng);
  const collarStyle = rng.pick(COLLAR_STYLES);
  const collarColor = rng.pick(TRIM_ROLES);
  const sleeveStyle = rng.pick(SLEEVE_STYLES);
  const cuffColor = rng.pick(TRIM_ROLES);
  const shortsColor = rng.pick(SHORTS_ROLES);
  const socksColor = rng.pick<ColorRole>([shortsColor, "primary"]);
  return {
    clubId: identity.id,
    colors,
    pattern: { id: template.id, base: "primary", overlay: "secondary", params },
    collar: { style: collarStyle, color: collarColor },
    sleeves: { style: sleeveStyle, color: "secondary", cuffColor },
    shorts: { color: shortsColor },
    socks: { color: socksColor },
  };
}

function pickPattern(identity: ClubIdentity, rng: Rng): PatternTemplate {
  const templates = listPatternTemplates();
  const weights = identity.style.patternWeights;
  for (const id of Object.keys(weights ?? {})) {
    if (!templates.some((template) => template.id === id)) throw new Error(`Unknown pattern "${id}" in style.patternWeights of club "${identity.id}"`);
  }
  const entries = templates.map((template) => [template, weights ? (weights[template.id] ?? 0) : template.defaultWeight] as const);
  if (!entries.some(([, weight]) => weight > 0)) throw new Error(`Club "${identity.id}" has no pattern with positive weight`);
  return rng.weighted(entries);
}

function randomParams(template: PatternTemplate, rng: Rng): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [key, spec] of Object.entries(template.parameters)) {
    const value = rng.range(spec.min, spec.max);
    params[key] = spec.integer ? Math.round(value) : Number(value.toFixed(3));
  }
  return params;
}

import type { ClubIdentity } from "../core/club.js";
import { COLLAR_STYLES, COLOR_ROLES, SLEEVE_STYLES, type ColorRole, type KitDefinition, type KitType } from "../core/kit.js";
import { resolvePalette, type Palette } from "../core/palette.js";
import { createRng, deriveSeed, type Rng } from "../core/random.js";
import { formatIssues, validateClub, validatePalette, type ValidationIssue } from "../core/validation.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";

export type KitSet = Record<KitType, KitDefinition>;

export const MAX_PALETTE_ATTEMPTS = 20;

// Papéis em ciclo (primary→secondary→accent→primary): cada par de kits divide no máximo uma cor e nunca inverte base e overlay, então os três se distinguem em campo.
const KIT_ROLES: Record<KitType, { base: ColorRole; overlay: ColorRole }> = {
  home: { base: "primary", overlay: "secondary" },
  away: { base: "secondary", overlay: "accent" },
  third: { base: "accent", overlay: "primary" },
};

export function generateKitSet(identity: ClubIdentity, seed: number): KitSet {
  const issues = validateClub(identity);
  if (issues.length > 0) throw new Error(`Club "${identity.id}" is invalid:\n${formatIssues(issues)}`);
  const palette = generatePalette(identity, seed);
  return {
    home: generateKit(identity, "home", palette, seed),
    away: generateKit(identity, "away", palette, seed),
    third: generateKit(identity, "third", palette, seed),
  };
}

// Só cores derivadas (secondary/accent ausentes no club.json) mudam entre tentativas; cores informadas pelo usuário já passaram por validateClub.
export function generatePalette(identity: ClubIdentity, seed: number): Palette {
  let issues: ValidationIssue[] = [];
  for (let attempt = 0; attempt < MAX_PALETTE_ATTEMPTS; attempt++) {
    const palette = resolvePalette(identity.palette, createRng(deriveSeed(seed, `palette:${attempt}`)));
    issues = validatePalette(palette);
    if (issues.length === 0) return palette;
  }
  throw new Error(`Could not derive a valid palette for club "${identity.id}" after ${MAX_PALETTE_ATTEMPTS} attempts:\n${formatIssues(issues)}`);
}

export function generateKit(identity: ClubIdentity, kitType: KitType, palette: Palette, seed: number): KitDefinition {
  const rng = createRng(deriveSeed(seed, kitType));
  const { base, overlay } = KIT_ROLES[kitType];
  const trimRoles = COLOR_ROLES.filter((role) => role !== base);
  // A ordem das chamadas ao rng faz parte do contrato de reprodutibilidade: reordenar muda os kits gerados para a mesma seed.
  const template = pickPattern(identity, rng);
  const params = randomParams(template, rng);
  const collarStyle = rng.pick(COLLAR_STYLES);
  const collarColor = rng.pick(trimRoles);
  const sleeveStyle = rng.pick(SLEEVE_STYLES);
  const cuffColor = rng.pick(trimRoles);
  const shortsColor = rng.pick([base, overlay]);
  const socksColor = rng.pick([shortsColor, base]);
  return {
    clubId: identity.id,
    kitType,
    generatedWith: { seed },
    colors: { ...palette },
    pattern: { id: template.id, base, overlay, params },
    collar: { style: collarStyle, color: collarColor },
    sleeves: { style: sleeveStyle, color: overlay, cuffColor },
    shorts: { color: shortsColor },
    socks: { color: socksColor },
  };
}

function pickPattern(identity: ClubIdentity, rng: Rng): PatternTemplate {
  const weights = identity.style.patternWeights;
  return rng.weighted(listPatternTemplates().map((template) => [template, weights ? (weights[template.id] ?? 0) : template.defaultWeight] as const));
}

function randomParams(template: PatternTemplate, rng: Rng): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [key, spec] of Object.entries(template.parameters)) {
    const value = rng.range(spec.min, spec.max);
    params[key] = spec.integer ? Math.round(value) : Number(value.toFixed(3));
  }
  return params;
}

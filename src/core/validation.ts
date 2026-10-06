import { findAsset, knownAssetIds, type AssetRegistry } from "../assets/registry.js";
import { listLayerTemplates, listPatternTemplates } from "../patterns/registry.js";
import { patternCandidates } from "../styles/pattern-weights.js";
import { findStyleProfile, knownStyleIds } from "../styles/profiles.js";
import type { ClubIdentity } from "./club.js";
import { colorDistance, contrastRatio } from "./color.js";
import {
  BRAND_KINDS,
  BRAND_LISTS,
  COLOR_ROLES,
  KIT_TYPES,
  resolveLogoColor,
  visibleRoles,
  type ColorRole,
  type KitDefinition,
  type KitType,
  type LogoSlot,
} from "./kit.js";
import { backgroundRoles, MIN_LOGO_CONTRAST, overlayShare } from "./logo-colors.js";
import type { Palette } from "./palette.js";

export interface ValidationIssue {
  rule: string;
  message: string;
}

// ΔE OKLab abaixo disto parece a mesma cor em campo (branco × #f0f0f0 = 0.045, ouro × laranja = 0.121, vermelho × laranja = 0.155).
export const MIN_COLOR_DISTANCE = 0.15;
const LOGO_SLOTS: readonly LogoSlot[] = ["badge", ...BRAND_KINDS];

function pairs<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((first, index) => items.slice(index + 1).map((second): [T, T] => [first, second]));
}

function tooSimilar(a: string, b: string): string | undefined {
  const distance = colorDistance(a, b);
  return distance < MIN_COLOR_DISTANCE ? `too similar (distance ${distance.toFixed(3)}, minimum ${MIN_COLOR_DISTANCE})` : undefined;
}

function knownPatternIds(): string[] {
  return listPatternTemplates().map((template) => template.id);
}

export function validateColors(colors: Partial<Record<ColorRole, string>>): ValidationIssue[] {
  const roles = COLOR_ROLES.filter((role) => colors[role] !== undefined);
  return pairs(roles).flatMap(([a, b]) => {
    const problem = tooSimilar(colors[a]!, colors[b]!);
    return problem ? [{ rule: "distinct-colors", message: `${a} ${colors[a]} and ${b} ${colors[b]} are ${problem}` }] : [];
  });
}

function traditionIssues(identity: ClubIdentity, known: readonly string[]): ValidationIssue[] {
  const traditions = identity.traditions;
  if (!traditions) return [];
  const forbidden = traditions.forbiddenPatterns ?? [];
  const lists: [string, readonly string[]][] = [
    ["traditions.forbiddenPatterns", forbidden],
    ...KIT_TYPES.map((kitType): [string, readonly string[]] => [`traditions.patterns.${kitType}`, traditions.patterns?.[kitType] ?? []]),
  ];
  const issues: ValidationIssue[] = [];
  for (const [field, ids] of lists) {
    for (const id of ids) {
      if (!known.includes(id)) issues.push({ rule: "unknown-pattern", message: `${field} references unknown pattern "${id}" (known: ${known.join(", ")})` });
    }
  }
  for (const kitType of KIT_TYPES) {
    for (const id of traditions.patterns?.[kitType] ?? []) {
      if (forbidden.includes(id))
        issues.push({ rule: "tradition-conflict", message: `traditions.patterns.${kitType} allows "${id}", which traditions.forbiddenPatterns forbids` });
    }
  }
  return issues;
}

export function validateClub(identity: ClubIdentity): ValidationIssue[] {
  const known = knownPatternIds();
  const weights = identity.style.patternWeights;
  const issues: ValidationIssue[] = [];
  for (const id of identity.style.categories) {
    if (!findStyleProfile(id))
      issues.push({ rule: "unknown-style", message: `style.categories references unknown style "${id}" (known: ${knownStyleIds().join(", ")})` });
  }
  for (const id of Object.keys(weights ?? {})) {
    if (!known.includes(id)) {
      issues.push({ rule: "unknown-pattern", message: `style.patternWeights references unknown pattern "${id}" (known: ${known.join(", ")})` });
    }
  }
  if (weights && !Object.entries(weights).some(([id, weight]) => known.includes(id) && weight > 0)) {
    issues.push({ rule: "no-pattern-weight", message: "style.patternWeights gives no known pattern a positive weight" });
  }
  for (const kind of BRAND_KINDS) {
    const pool = identity[BRAND_LISTS[kind]];
    if (pool && !Object.values(pool).some((weight) => weight > 0)) {
      issues.push({ rule: "no-asset-weight", message: `${BRAND_LISTS[kind]} gives no ${kind} a positive weight` });
    }
  }
  issues.push(...traditionIssues(identity, known));
  const traditions = identity.traditions;
  // Os candidatos dependem de estilos e pesos válidos; quebrados, as regras acima já explicam o problema.
  if (traditions?.forbiddenPatterns && !issues.some((issue) => issue.rule === "unknown-style" || issue.rule === "no-pattern-weight")) {
    for (const kitType of KIT_TYPES) {
      if (traditions.patterns?.[kitType]) continue;
      if (!patternCandidates(identity, kitType).some(([, weight]) => weight > 0)) {
        issues.push({ rule: "no-pattern-weight", message: `traditions.forbiddenPatterns leaves the ${kitType} kit without a pattern with positive weight` });
      }
    }
  }
  return [...issues, ...validateColors(identity.palette)];
}

export function validateClubAssets(identity: ClubIdentity, registry: AssetRegistry): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) =>
    Object.keys(identity[BRAND_LISTS[kind]] ?? {})
      .filter((id) => !findAsset(registry, kind, id))
      .map((id) => ({ rule: "unknown-asset", message: `${BRAND_LISTS[kind]} references unknown ${kind} "${id}" (known: ${knownAssetIds(registry, kind)})` })),
  );
}

export function validatePalette(palette: Palette): ValidationIssue[] {
  return validateColors(palette);
}

function logoContrastIssues(kit: KitDefinition): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) => {
    const logo = kit[kind];
    if (!logo) return [];
    const color = resolveLogoColor(kit, logo.color);
    const outline = logo.outline === undefined ? undefined : resolveLogoColor(kit, logo.outline);
    const label = `${kit.kitType} kit ${kind} ${color}`;
    const issues: ValidationIssue[] = [];
    if (outline !== undefined && contrastRatio(color, outline) < MIN_LOGO_CONTRAST) {
      const contrast = contrastRatio(color, outline).toFixed(2);
      issues.push({ rule: "logo-contrast", message: `${label} and its outline ${outline} have contrast ${contrast} (minimum ${MIN_LOGO_CONTRAST})` });
    }
    for (const role of backgroundRoles(kit, kind)) {
      const background = kit.colors[role];
      const contrast = Math.max(contrastRatio(color, background), outline === undefined ? 0 : contrastRatio(outline, background));
      if (contrast < MIN_LOGO_CONTRAST) {
        const subject = outline === undefined ? label : `${label} with outline ${outline}`;
        issues.push({
          rule: "logo-contrast",
          message: `${subject} has contrast ${contrast.toFixed(2)} against ${role} ${background} (minimum ${MIN_LOGO_CONTRAST})`,
        });
      }
    }
    return issues;
  });
}

function layerIssues(kit: KitDefinition): ValidationIssue[] {
  const layerIds = listLayerTemplates().map((template) => template.id);
  const templates = new Map(listPatternTemplates().map((template) => [template.id, template]));
  // O solid não pinta o overlay no corpo, então a camada pode usar a cor dele.
  const painted = kit.pattern.id === "solid" ? [kit.pattern.base] : [kit.pattern.base, kit.pattern.overlay];
  const used = new Set([kit.pattern.id]);
  const issues: ValidationIssue[] = [];
  for (const layer of kit.layers ?? []) {
    const label = `${kit.kitType} kit layer "${layer.id}"`;
    if (!layerIds.includes(layer.id)) issues.push({ rule: "unknown-layer", message: `${label} is not a layer pattern (known: ${layerIds.join(", ")})` });
    if (used.has(layer.id)) issues.push({ rule: "layer-duplicate", message: `${label} repeats the pattern or another layer` });
    used.add(layer.id);
    if (painted.includes(layer.color)) issues.push({ rule: "layer-color", message: `${label} uses ${layer.color}, which the pattern already paints` });
    const template = templates.get(layer.id);
    // Fora do registry não há colorAt para medir; unknown-layer já explica o problema.
    if (!template) continue;
    for (const slot of LOGO_SLOTS) {
      if (overlayShare(template, layer.params, slot) > 0) issues.push({ rule: "layer-logo-overlap", message: `${label} paints over the ${slot} box` });
    }
  }
  return issues;
}

export function validateKit(kit: KitDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = knownPatternIds();
  const patternKnown = known.includes(kit.pattern.id);
  if (!patternKnown) {
    issues.push({ rule: "unknown-pattern", message: `${kit.kitType} kit uses unknown pattern "${kit.pattern.id}" (known: ${known.join(", ")})` });
  }
  const { base, overlay } = kit.pattern;
  // O overlay também pinta as mangas "solid", então a regra vale mesmo para o padrão "solid".
  if (base === overlay) {
    issues.push({ rule: "pattern-contrast", message: `${kit.kitType} kit uses ${base} as both pattern base and overlay` });
  } else {
    const problem = tooSimilar(kit.colors[base], kit.colors[overlay]);
    if (problem) {
      issues.push({ rule: "pattern-contrast", message: `${kit.kitType} kit base ${kit.colors[base]} and overlay ${kit.colors[overlay]} are ${problem}` });
    }
  }
  // Sem colorAt não há como medir o fundo; unknown-pattern já explica o problema.
  if (patternKnown) issues.push(...logoContrastIssues(kit));
  return [...issues, ...layerIssues(kit)];
}

export function validateKitAssets(kit: KitDefinition, registry: AssetRegistry): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) => {
    const logo = kit[kind];
    if (!logo || findAsset(registry, kind, logo.id)) return [];
    return [{ rule: "unknown-asset", message: `${kit.kitType} kit references unknown ${kind} "${logo.id}" (known: ${knownAssetIds(registry, kind)})` }];
  });
}

// Pega kit.json editado à mão; o generator já respeita as tradições ao sortear.
export function validateKitTraditions(identity: ClubIdentity, kit: KitDefinition): ValidationIssue[] {
  const traditions = identity.traditions;
  if (!traditions) return [];
  const issues: ValidationIssue[] = [];
  const pattern = kit.pattern.id;
  if (traditions.forbiddenPatterns?.includes(pattern)) {
    issues.push({ rule: "forbidden-pattern", message: `${kit.kitType} kit uses pattern "${pattern}", which traditions.forbiddenPatterns forbids` });
  }
  for (const layer of kit.layers ?? []) {
    if (traditions.forbiddenPatterns?.includes(layer.id)) {
      issues.push({ rule: "forbidden-pattern", message: `${kit.kitType} kit uses layer "${layer.id}", which traditions.forbiddenPatterns forbids` });
    }
  }
  const allowed = traditions.patterns?.[kit.kitType];
  if (allowed && !allowed.includes(pattern)) {
    issues.push({
      rule: "tradition-pattern",
      message: `${kit.kitType} kit uses pattern "${pattern}", but traditions.patterns.${kit.kitType} allows only ${allowed.join(", ")}`,
    });
  }
  const required = traditions.requiredColor;
  if (required !== undefined && !visibleRoles(kit).includes(required)) {
    issues.push({
      rule: "required-color",
      message: `${kit.kitType} kit does not show ${required} ${kit.colors[required]} (traditions.requiredColor) on the pattern, layers, sleeves, collar or cuffs`,
    });
  }
  return issues;
}

export function validateKitSet(kits: Partial<Record<KitType, KitDefinition>>): ValidationIssue[] {
  const present = KIT_TYPES.flatMap((kitType) => kits[kitType] ?? []);
  const issues: ValidationIssue[] = [];
  const clubIds = [...new Set(present.map((kit) => kit.clubId))];
  if (clubIds.length > 1) issues.push({ rule: "club-mismatch", message: `kits belong to different clubs: ${clubIds.join(", ")}` });
  // O FM precisa distinguir os uniformes em campo; a cor base domina a camisa.
  for (const [a, b] of pairs(present)) {
    const [colorA, colorB] = [a.colors[a.pattern.base], b.colors[b.pattern.base]];
    const problem = tooSimilar(colorA, colorB);
    if (problem) issues.push({ rule: "kit-clash", message: `${a.kitType} base ${colorA} and ${b.kitType} base ${colorB} are ${problem}` });
  }
  return issues;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `  - ${issue.rule}: ${issue.message}`).join("\n");
}

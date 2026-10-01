import { findAsset, knownAssetIds, type AssetRegistry } from "../assets/registry.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { ClubIdentity } from "./club.js";
import { colorDistance } from "./color.js";
import { BRAND_KINDS, BRAND_LISTS, COLOR_ROLES, KIT_TYPES, type ColorRole, type KitDefinition, type KitType } from "./kit.js";
import type { Palette } from "./palette.js";

export interface ValidationIssue {
  rule: string;
  message: string;
}

// ΔE OKLab abaixo disto parece a mesma cor em campo (branco × #f0f0f0 = 0.045, ouro × laranja = 0.121, vermelho × laranja = 0.155).
export const MIN_COLOR_DISTANCE = 0.15;

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

export function validateClub(identity: ClubIdentity): ValidationIssue[] {
  const known = knownPatternIds();
  const weights = identity.style.patternWeights;
  const issues: ValidationIssue[] = [];
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

export function validateKit(kit: KitDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = knownPatternIds();
  if (!known.includes(kit.pattern.id)) {
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
  return issues;
}

export function validateKitAssets(kit: KitDefinition, registry: AssetRegistry): ValidationIssue[] {
  return BRAND_KINDS.flatMap((kind) => {
    const logo = kit[kind];
    if (!logo || findAsset(registry, kind, logo.id)) return [];
    return [{ rule: "unknown-asset", message: `${kit.kitType} kit references unknown ${kind} "${logo.id}" (known: ${knownAssetIds(registry, kind)})` }];
  });
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

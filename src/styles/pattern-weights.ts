import type { ClubIdentity } from "../core/club.js";
import type { KitType } from "../core/kit.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
import { resolveProfileWeights } from "./profile-weights.js";
import type { Weights } from "./profiles.js";

export function resolvePatternWeights(identity: ClubIdentity): Weights<string> {
  return identity.style.patternWeights ?? resolveProfileWeights(identity, (profile) => profile.patternWeights);
}

// Ordem do registry: rng.weighted percorre os candidatos nesta ordem, e mudá-la muda os kits de uma seed.
export function patternCandidates(identity: ClubIdentity, kitType: KitType): [PatternTemplate, number][] {
  const weights = resolvePatternWeights(identity);
  const forbidden = new Set(identity.traditions?.forbiddenPatterns ?? []);
  const allowed = identity.traditions?.patterns?.[kitType];
  const templates = listPatternTemplates().filter((template) => allowed === undefined || allowed.includes(template.id));
  const weightOf = (template: PatternTemplate): number => (forbidden.has(template.id) ? 0 : (weights[template.id] ?? 0));
  // A tradição vence o perfil: uma lista só com pesos zero vira sorteio uniforme entre os padrões permitidos dela.
  const uniform = allowed !== undefined && templates.every((template) => weightOf(template) === 0);
  return templates.map((template) => [template, uniform && !forbidden.has(template.id) ? 1 : weightOf(template)]);
}

import type { ClubIdentity } from "../core/club.js";
import { listPatternTemplates } from "../patterns/registry.js";
import type { PatternTemplate } from "../patterns/types.js";
import { DEFAULT_STYLE_PROFILE, getStyleProfile } from "./profiles.js";

export function resolvePatternWeights(identity: ClubIdentity): Record<string, number> {
  if (identity.style.patternWeights) return identity.style.patternWeights;
  // Set: categoria repetida conta uma vez, sem depender de a soma de frações coincidir bit a bit.
  const ids = [...new Set(identity.style.categories)];
  // Sem normalizar: os números de classic são os mesmos de antes dos perfis, e o sorteio fica idêntico ao das seeds antigas.
  if (ids.length === 0) return getStyleProfile(DEFAULT_STYLE_PROFILE).patternWeights;
  const weights: Record<string, number> = {};
  for (const id of ids) {
    const profile = getStyleProfile(id).patternWeights;
    const total = Object.values(profile).reduce((sum, weight) => sum + weight, 0);
    // Normalizar antes da média impede que um perfil com números maiores domine a combinação.
    for (const [pattern, weight] of Object.entries(profile)) weights[pattern] = (weights[pattern] ?? 0) + weight / total / ids.length;
  }
  return weights;
}

// Ordem do registry: rng.weighted percorre os candidatos nesta ordem, e mudá-la muda os kits de uma seed.
export function patternCandidates(identity: ClubIdentity): [PatternTemplate, number][] {
  const weights = resolvePatternWeights(identity);
  return listPatternTemplates().map((template) => [template, weights[template.id] ?? 0]);
}

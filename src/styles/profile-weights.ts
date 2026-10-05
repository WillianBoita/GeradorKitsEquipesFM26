import type { ClubIdentity } from "../core/club.js";
import { DEFAULT_STYLE_PROFILE, getStyleProfile, type StyleProfile, type Weights } from "./profiles.js";

// Uma regra para todas as tabelas dos perfis (padrão, gola, manga): mudar a média aqui muda todas juntas.
export function resolveProfileWeights<K extends string>(identity: ClubIdentity, select: (profile: StyleProfile) => Weights<K>): Weights<K> {
  // Set: categoria repetida conta uma vez, sem depender de a soma de frações coincidir bit a bit.
  const ids = [...new Set(identity.style.categories)];
  // Sem normalizar: os números de classic são os de antes dos perfis, e o sorteio fica idêntico ao das seeds antigas.
  if (ids.length === 0) return select(getStyleProfile(DEFAULT_STYLE_PROFILE));
  const weights: Weights<K> = {};
  for (const id of ids) {
    const table = Object.entries(select(getStyleProfile(id))) as [K, number][];
    const total = table.reduce((sum, [, weight]) => sum + weight, 0);
    // Normalizar antes da média impede que um perfil com números maiores domine a combinação.
    for (const [key, weight] of table) weights[key] = (weights[key] ?? 0) + weight / total / ids.length;
  }
  return weights;
}

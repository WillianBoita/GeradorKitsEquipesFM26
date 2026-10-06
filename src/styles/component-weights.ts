import type { ClubIdentity } from "../core/club.js";
import { COLLAR_STYLES, SLEEVE_CUTS, SLEEVE_STYLES, type CollarStyle, type SleeveCut, type SleeveStyle } from "../core/kit.js";
import { resolveProfileWeights } from "./profile-weights.js";
import { LAYER_COUNTS, type LayerCount, type Weights } from "./profiles.js";

// Ordem do enum, não das chaves do perfil: rng.weighted percorre os candidatos nesta ordem, e reordenar uma tabela não pode mudar os kits de uma seed.
function candidates<K extends string>(values: readonly K[], weights: Weights<K>): [K, number][] {
  return values.map((value) => [value, weights[value] ?? 0]);
}

export function collarCandidates(identity: ClubIdentity): [CollarStyle, number][] {
  return candidates(
    COLLAR_STYLES,
    resolveProfileWeights(identity, (profile) => profile.collarWeights),
  );
}

export function sleeveStyleCandidates(identity: ClubIdentity): [SleeveStyle, number][] {
  return candidates(
    SLEEVE_STYLES,
    resolveProfileWeights(identity, (profile) => profile.sleeveStyleWeights),
  );
}

export function sleeveCutCandidates(identity: ClubIdentity): [SleeveCut, number][] {
  return candidates(
    SLEEVE_CUTS,
    resolveProfileWeights(identity, (profile) => profile.sleeveCutWeights),
  );
}

export function layerCountCandidates(identity: ClubIdentity): [LayerCount, number][] {
  return candidates(
    LAYER_COUNTS,
    resolveProfileWeights(identity, (profile) => profile.layerCountWeights),
  );
}

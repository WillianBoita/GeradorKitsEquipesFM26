import type { CollarStyle, SleeveCut, SleeveStyle } from "../core/kit.js";

// Quantidade de camadas por kit, de 0 a MAX_LAYERS (core/kit.ts); string porque vira chave de tabela de peso.
export const LAYER_COUNTS = ["0", "1", "2"] as const;
export type LayerCount = (typeof LAYER_COUNTS)[number];

export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
  collarWeights: Weights<CollarStyle>;
  sleeveStyleWeights: Weights<SleeveStyle>;
  sleeveCutWeights: Weights<SleeveCut>;
  layerCountWeights: Weights<LayerCount>;
  // Só padrões com layerSlot; o sorteio zera os da região que o kit já ocupa.
  layerWeights: Record<string, number>;
}

export type Weights<K extends string> = Partial<Record<K, number>>;

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; classic nunca sorteia camada.
export const DEFAULT_STYLE_PROFILE = "classic";

export const STYLE_PROFILES: readonly StyleProfile[] = [
  {
    id: "classic",
    name: "Classic",
    patternWeights: { solid: 40, stripes: 35, sash: 25 },
    collarWeights: { round: 1, "v-neck": 1 },
    sleeveStyleWeights: { "match-body": 1, solid: 1 },
    sleeveCutWeights: { "set-in": 1 },
    layerCountWeights: { 0: 1 },
    layerWeights: {},
  },
  {
    id: "traditional",
    name: "Traditional",
    patternWeights: { solid: 25, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5, "gradient-radial": 5 },
    collarWeights: { round: 35, "v-neck": 25, polo: 25, "polo-v": 15 },
    sleeveStyleWeights: { "match-body": 75, solid: 25 },
    sleeveCutWeights: { "set-in": 90, raglan: 10 },
    layerCountWeights: { 0: 70, 1: 30 },
    layerWeights: { "double-pinline": 30, "side-lines": 25, "shoulder-line": 25, "hoop-line": 20 },
  },
  {
    id: "modern",
    name: "Modern",
    patternWeights: { solid: 10, diagonal: 15, gradient: 15, checkers: 15, halves: 10, chevron: 10, sash: 10, "gradient-diagonal": 10, "gradient-radial": 5 },
    collarWeights: { round: 40, "v-neck": 40, "polo-v": 20 },
    sleeveStyleWeights: { "match-body": 80, solid: 20 },
    sleeveCutWeights: { "set-in": 50, raglan: 50 },
    layerCountWeights: { 0: 30, 1: 50, 2: 20 },
    layerWeights: { "torso-circle": 20, "torso-diamond": 20, "torso-triangle": 20, "torso-cross": 15, "side-lines": 15, "shoulder-line": 10 },
  },
  {
    id: "retro",
    name: "Retro",
    patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 5, "gradient-diagonal": 5 },
    collarWeights: { round: 15, "v-neck": 15, polo: 35, "polo-v": 35 },
    sleeveStyleWeights: { "match-body": 70, solid: 30 },
    sleeveCutWeights: { "set-in": 80, raglan: 20 },
    layerCountWeights: { 0: 40, 1: 45, 2: 15 },
    layerWeights: { "hoop-line": 30, "double-pinline": 25, "side-lines": 25, "shoulder-line": 10, "torso-cross": 10 },
  },
];

export function knownStyleIds(): string[] {
  return STYLE_PROFILES.map((profile) => profile.id);
}

export function findStyleProfile(id: string): StyleProfile | undefined {
  return STYLE_PROFILES.find((profile) => profile.id === id);
}

export function getStyleProfile(id: string): StyleProfile {
  const profile = findStyleProfile(id);
  if (!profile) throw new Error(`Unknown style "${id}". Known styles: ${knownStyleIds().join(", ")}`);
  return profile;
}

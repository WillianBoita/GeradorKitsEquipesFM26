import type { CollarStyle, SleeveStyle } from "../core/kit.js";

export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
  collarWeights: Weights<CollarStyle>;
  sleeveStyleWeights: Weights<SleeveStyle>;
}

export type Weights<K extends string> = Partial<Record<K, number>>;

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
// Em gola e manga, pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis.
export const DEFAULT_STYLE_PROFILE = "classic";

export const STYLE_PROFILES: readonly StyleProfile[] = [
  {
    id: "classic",
    name: "Classic",
    patternWeights: { solid: 40, stripes: 35, sash: 25 },
    collarWeights: { round: 1, "v-neck": 1 },
    sleeveStyleWeights: { "match-body": 1, solid: 1 },
  },
  {
    id: "traditional",
    name: "Traditional",
    patternWeights: { solid: 30, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5 },
    collarWeights: { round: 35, "v-neck": 25 },
    sleeveStyleWeights: { "match-body": 75, solid: 25 },
  },
  {
    id: "modern",
    name: "Modern",
    patternWeights: { solid: 10, diagonal: 20, gradient: 20, checkers: 15, halves: 15, chevron: 10, sash: 10 },
    collarWeights: { round: 40, "v-neck": 40 },
    sleeveStyleWeights: { "match-body": 80, solid: 20 },
  },
  {
    id: "retro",
    name: "Retro",
    patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 10 },
    collarWeights: { round: 15, "v-neck": 15 },
    sleeveStyleWeights: { "match-body": 70, solid: 30 },
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

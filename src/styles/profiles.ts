export interface StyleProfile {
  id: string;
  name: string;
  patternWeights: Record<string, number>;
}

// Clube sem categories nem patternWeights usa classic: são os pesos de antes dos perfis, então as seeds antigas geram os mesmos kits.
export const DEFAULT_STYLE_PROFILE = "classic";

export const STYLE_PROFILES: readonly StyleProfile[] = [
  { id: "classic", name: "Classic", patternWeights: { solid: 40, stripes: 35, sash: 25 } },
  { id: "traditional", name: "Traditional", patternWeights: { solid: 30, stripes: 25, pinstripes: 15, hoops: 15, sash: 10, halves: 5 } },
  { id: "modern", name: "Modern", patternWeights: { solid: 10, diagonal: 20, gradient: 20, checkers: 15, halves: 15, chevron: 10, sash: 10 } },
  { id: "retro", name: "Retro", patternWeights: { hoops: 20, "chest-band": 20, "center-band": 20, chevron: 20, stripes: 10, solid: 10 } },
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

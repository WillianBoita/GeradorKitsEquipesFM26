import { describe, expect, it } from "vitest";
import { listPatternTemplates } from "../../src/patterns/registry.js";
import { DEFAULT_STYLE_PROFILE, findStyleProfile, getStyleProfile, knownStyleIds, STYLE_PROFILES } from "../../src/styles/profiles.js";

const patternIds = listPatternTemplates().map((template) => template.id);

describe("STYLE_PROFILES", () => {
  it("lists classic, traditional, modern and retro", () => {
    expect(knownStyleIds()).toEqual(["classic", "traditional", "modern", "retro"]);
  });

  it("references only registered patterns, with positive weights", () => {
    for (const profile of STYLE_PROFILES) {
      for (const [id, weight] of Object.entries(profile.patternWeights)) {
        expect(patternIds).toContain(id);
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  // Padrão de camada só entra em layerWeights: como principal sorteado pelo perfil, ele deixaria o tronco quase liso.
  it("reaches every pattern that is not a layer from patternWeights, and no layer pattern", () => {
    const reached = new Set(STYLE_PROFILES.flatMap((profile) => Object.keys(profile.patternWeights)));
    const principal = listPatternTemplates()
      .filter((template) => template.layerSlot === undefined)
      .map((template) => template.id);
    expect([...reached].sort()).toEqual([...principal].sort());
  });

  // As seeds de clubes sem estilo dependem destes números exatos.
  it("keeps classic equal to the weights used before profiles existed", () => {
    expect(DEFAULT_STYLE_PROFILE).toBe("classic");
    expect(getStyleProfile("classic").patternWeights).toEqual({ solid: 40, stripes: 35, sash: 25 });
  });

  // Pesos iguais com rng.weighted escolhem o mesmo índice que o rng.pick de antes dos perfis; só set-in mantém o corte antigo.
  it("keeps classic collars and sleeve styles even, and its sleeves set-in", () => {
    expect(getStyleProfile("classic").collarWeights).toEqual({ round: 1, "v-neck": 1 });
    expect(getStyleProfile("classic").sleeveStyleWeights).toEqual({ "match-body": 1, solid: 1 });
    expect(getStyleProfile("classic").sleeveCutWeights).toEqual({ "set-in": 1 });
  });

  it("gives every profile a positive weight in each component table", () => {
    for (const profile of STYLE_PROFILES) {
      for (const table of [profile.collarWeights, profile.sleeveStyleWeights, profile.sleeveCutWeights]) {
        const weights = Object.values(table);
        expect(weights.length).toBeGreaterThan(0);
        for (const weight of weights) expect(weight).toBeGreaterThan(0);
      }
    }
  });
});

describe("getStyleProfile", () => {
  it("finds a profile by id", () => {
    expect(findStyleProfile("retro")?.name).toBe("Retro");
    expect(findStyleProfile("dark")).toBeUndefined();
  });

  it("throws a helpful error for unknown styles", () => {
    expect(() => getStyleProfile("dark")).toThrow('Unknown style "dark". Known styles: classic, traditional, modern, retro');
  });
});

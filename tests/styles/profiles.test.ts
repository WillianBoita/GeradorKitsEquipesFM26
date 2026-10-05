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

  it("reaches every registered pattern from at least one profile", () => {
    const reached = new Set(STYLE_PROFILES.flatMap((profile) => Object.keys(profile.patternWeights)));
    expect([...reached].sort()).toEqual([...patternIds].sort());
  });

  // As seeds de clubes sem estilo dependem destes números exatos.
  it("keeps classic equal to the weights used before profiles existed", () => {
    expect(DEFAULT_STYLE_PROFILE).toBe("classic");
    expect(getStyleProfile("classic").patternWeights).toEqual({ solid: 40, stripes: 35, sash: 25 });
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

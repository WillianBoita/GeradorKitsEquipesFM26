import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { listPatternTemplates } from "../../src/patterns/registry.js";
import { patternCandidates, resolvePatternWeights } from "../../src/styles/pattern-weights.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (style: object) => parseClubIdentity({ ...GALATICOS_CLUB, style });

describe("resolvePatternWeights", () => {
  it("uses the club pattern weights over its categories", () => {
    expect(resolvePatternWeights(club({ categories: ["retro"], patternWeights: { solid: 2 } }))).toEqual({ solid: 2 });
  });

  it("uses the raw classic weights when the club has no categories", () => {
    expect(resolvePatternWeights(club({ categories: [] }))).toEqual({ solid: 40, stripes: 35, sash: 25 });
  });

  it("normalizes a single profile", () => {
    const weights = resolvePatternWeights(club({ categories: ["modern"] }));
    expect(weights.diagonal).toBeCloseTo(0.2);
    expect(Object.values(weights).reduce<number>((sum, weight) => sum + (weight ?? 0), 0)).toBeCloseTo(1);
  });

  it("averages the normalized profiles", () => {
    const weights = resolvePatternWeights(club({ categories: ["traditional", "retro"] }));
    expect(weights.solid).toBeCloseTo(0.2);
    expect(weights.hoops).toBeCloseTo(0.175);
    expect(weights.pinstripes).toBeCloseTo(0.075);
    expect(weights["chest-band"]).toBeCloseTo(0.1);
  });

  it("treats a repeated category as one", () => {
    expect(resolvePatternWeights(club({ categories: ["modern", "modern"] }))).toEqual(resolvePatternWeights(club({ categories: ["modern"] })));
  });
});

describe("patternCandidates", () => {
  const withTraditions = (traditions: object) => parseClubIdentity({ ...GALATICOS_CLUB, traditions });
  const positive = (candidates: ReturnType<typeof patternCandidates>) =>
    candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight]);

  it("lists every registered pattern in registry order, with zero for the missing ones", () => {
    const candidates = patternCandidates(club({ categories: [], patternWeights: { sash: 3 } }), "home");
    expect(candidates.map(([template]) => template.id)).toEqual(listPatternTemplates().map((template) => template.id));
    expect(positive(candidates)).toEqual([["sash", 3]]);
  });

  it("gives forbidden patterns zero weight", () => {
    expect(positive(patternCandidates(withTraditions({ forbiddenPatterns: ["sash"] }), "away"))).toEqual([
      ["solid", 20],
      ["stripes", 40],
    ]);
  });

  it("keeps only the patterns listed for the kit type, in registry order", () => {
    const club = withTraditions({ patterns: { home: ["sash", "stripes"] } });
    expect(patternCandidates(club, "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["stripes", 40],
      ["sash", 40],
    ]);
    expect(patternCandidates(club, "away")).toHaveLength(listPatternTemplates().length);
  });

  it("draws uniformly from a list whose weights are all zero", () => {
    expect(patternCandidates(withTraditions({ patterns: { home: ["hoops", "halves"] } }), "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["hoops", 1],
      ["halves", 1],
    ]);
  });

  it("never revives a forbidden pattern in the uniform draw", () => {
    const club = withTraditions({ forbiddenPatterns: ["halves"], patterns: { home: ["hoops", "halves"] } });
    expect(patternCandidates(club, "home").map(([template, weight]) => [template.id, weight])).toEqual([
      ["hoops", 1],
      ["halves", 0],
    ]);
  });
});

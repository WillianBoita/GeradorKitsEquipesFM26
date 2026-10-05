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
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
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
  it("lists every registered pattern in registry order, with zero for the missing ones", () => {
    const candidates = patternCandidates(club({ categories: [], patternWeights: { sash: 3 } }));
    expect(candidates.map(([template]) => template.id)).toEqual(listPatternTemplates().map((template) => template.id));
    expect(candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight])).toEqual([["sash", 3]]);
  });
});

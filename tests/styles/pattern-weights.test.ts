import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { listLayerTemplates, listPatternTemplates } from "../../src/patterns/registry.js";
import { layerCandidates, patternCandidates, resolvePatternWeights } from "../../src/styles/pattern-weights.js";
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
    expect(weights.diagonal).toBeCloseTo(0.15);
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

describe("layerCandidates", () => {
  const styled = (categories: string[], traditions?: object) =>
    parseClubIdentity({ ...GALATICOS_CLUB, style: { categories }, ...(traditions === undefined ? {} : { traditions }) });
  const positive = (candidates: ReturnType<typeof layerCandidates>) =>
    candidates.filter(([, weight]) => weight > 0).map(([template, weight]) => [template.id, weight]);

  it("lists only the layer patterns, in registry order", () => {
    expect(layerCandidates(styled(["modern"]), []).map(([template]) => template.id)).toEqual(listLayerTemplates().map((template) => template.id));
  });

  it("offers no layer when the club has no categories", () => {
    expect(positive(layerCandidates(styled([]), []))).toEqual([]);
  });

  it("uses the normalized layer weights of the profiles", () => {
    expect(positive(layerCandidates(styled(["traditional"]), ["solid"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.3],
      ["shoulder-line", 0.25],
      ["hoop-line", 0.2],
    ]);
  });

  it("averages classic with another profile without NaN", () => {
    const weights = layerCandidates(styled(["classic", "modern"]), []).map(([, weight]) => weight);
    for (const weight of weights) expect(Number.isFinite(weight)).toBe(true);
    expect(positive(layerCandidates(styled(["classic", "modern"]), []))).toContainEqual(["side-lines", 0.2]);
  });

  it("zeroes forbidden patterns and every layer in a slot that the pattern or a drawn layer takes", () => {
    const club = styled(["retro"], { forbiddenPatterns: ["shoulder-line"] });
    expect(positive(layerCandidates(club, ["solid"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.25],
      ["hoop-line", 0.3],
    ]);
    expect(positive(layerCandidates(club, ["solid", "hoop-line"]))).toEqual([
      ["side-lines", 0.25],
      ["double-pinline", 0.25],
    ]);
    expect(positive(layerCandidates(club, ["side-lines", "hoop-line"]))).toEqual([]);
  });
});

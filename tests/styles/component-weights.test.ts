import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { COLLAR_STYLES } from "../../src/core/kit.js";
import { collarCandidates, sleeveCutCandidates, sleeveStyleCandidates } from "../../src/styles/component-weights.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (categories: string[]) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });
const positive = <K>(candidates: [K, number][]) => candidates.filter(([, weight]) => weight > 0);

describe("collarCandidates", () => {
  it("draws the classic collars evenly when the club has no categories", () => {
    expect(positive(collarCandidates(club([])))).toEqual([
      ["round", 1],
      ["v-neck", 1],
    ]);
  });

  it("lists every collar in enum order", () => {
    expect(collarCandidates(club(["modern"])).map(([style]) => style)).toEqual([...COLLAR_STYLES]);
  });

  it("offers the polo collars through the retro profile", () => {
    const candidates = collarCandidates(club(["retro"]));
    expect(candidates.map(([style]) => style)).toEqual(["round", "v-neck", "polo", "polo-v"]);
    expect(candidates.map(([, weight]) => weight)).toEqual([0.15, 0.15, 0.35, 0.35]);
  });
});

describe("sleeveStyleCandidates", () => {
  it("draws the classic sleeve styles evenly when the club has no categories", () => {
    expect(sleeveStyleCandidates(club([]))).toEqual([
      ["match-body", 1],
      ["solid", 1],
    ]);
  });

  it("makes plain sleeves rarer in the modern profile", () => {
    const [[, matchBody], [, solid]] = sleeveStyleCandidates(club(["modern"]));
    expect(matchBody).toBeCloseTo(0.8);
    expect(solid).toBeCloseTo(0.2);
  });
});

describe("sleeveCutCandidates", () => {
  it("keeps a club without categories on set-in sleeves", () => {
    expect(sleeveCutCandidates(club([]))).toEqual([
      ["set-in", 1],
      ["raglan", 0],
    ]);
  });

  it("splits the modern profile between set-in and raglan", () => {
    const [[, setIn], [, raglan]] = sleeveCutCandidates(club(["modern"]));
    expect(setIn).toBeCloseTo(0.5);
    expect(raglan).toBeCloseTo(0.5);
  });
});

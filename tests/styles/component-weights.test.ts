import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { COLLAR_STYLES } from "../../src/core/kit.js";
import {
  collarCandidates,
  layerCountCandidates,
  shortsTrimCandidates,
  sleeveCutCandidates,
  sleeveStyleCandidates,
  socksTrimCandidates,
  trimStripeCandidates,
} from "../../src/styles/component-weights.js";
import { SHORTS_TRIM_OPTIONS, SOCKS_TRIM_OPTIONS, TRIM_STRIPE_OPTIONS } from "../../src/styles/profiles.js";
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

describe("layerCountCandidates", () => {
  it("never draws a layer when the club has no categories", () => {
    expect(layerCountCandidates(club([]))).toEqual([
      ["0", 1],
      ["1", 0],
      ["2", 0],
    ]);
  });

  it("draws up to two layers in the modern profile", () => {
    const [[, none], [, one], [, two]] = layerCountCandidates(club(["modern"]));
    expect(none).toBeCloseTo(0.3);
    expect(one).toBeCloseTo(0.5);
    expect(two).toBeCloseTo(0.2);
  });

  // A tabela de classic entra na média como as outras; a de layerWeights, vazia, não gera NaN.
  it("mixes classic with another profile", () => {
    const [[, none], [, one], [, two]] = layerCountCandidates(club(["classic", "modern"]));
    expect(none).toBeCloseTo(0.65);
    expect(one).toBeCloseTo(0.25);
    expect(two).toBeCloseTo(0.1);
  });
});

describe("trimStripeCandidates", () => {
  it("never draws a trim stripe when the club has no categories", () => {
    expect(trimStripeCandidates(club([]))).toEqual([
      ["none", 1],
      ["single", 0],
      ["double", 0],
    ]);
  });

  it("lists the options in a fixed order and favors stripes in the retro profile", () => {
    const candidates = trimStripeCandidates(club(["retro"]));
    expect(candidates.map(([option]) => option)).toEqual([...TRIM_STRIPE_OPTIONS]);
    const [[, none], [, single], [, double]] = candidates;
    expect(none).toBeCloseTo(0.4);
    expect(single).toBeCloseTo(0.3);
    expect(double).toBeCloseTo(0.3);
  });
});

describe("shortsTrimCandidates and socksTrimCandidates", () => {
  it("never draws a shorts or socks trim when the club has no categories", () => {
    expect(shortsTrimCandidates(club([]))).toEqual([
      ["none", 1],
      ["side-stripe", 0],
      ["side-piping", 0],
      ["hem-band", 0],
    ]);
    expect(socksTrimCandidates(club([]))).toEqual([
      ["none", 1],
      ["turnover", 0],
      ["top-hoops", 0],
      ["hoops", 0],
    ]);
  });

  it("lists the options in a fixed order and follows the retro profile", () => {
    const shorts = shortsTrimCandidates(club(["retro"]));
    const socks = socksTrimCandidates(club(["retro"]));
    expect(shorts.map(([option]) => option)).toEqual([...SHORTS_TRIM_OPTIONS]);
    expect(socks.map(([option]) => option)).toEqual([...SOCKS_TRIM_OPTIONS]);
    expect(shorts.map(([, weight]) => Number(weight.toFixed(4)))).toEqual([0.4, 0.3, 0.1, 0.2]);
    expect(socks.map(([, weight]) => Number(weight.toFixed(4)))).toEqual([0.25, 0.3, 0.2, 0.25]);
  });
});

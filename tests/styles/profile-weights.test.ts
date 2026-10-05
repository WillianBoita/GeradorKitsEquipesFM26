import { describe, expect, it } from "vitest";
import { parseClubIdentity } from "../../src/core/club.js";
import { resolveProfileWeights } from "../../src/styles/profile-weights.js";
import type { StyleProfile } from "../../src/styles/profiles.js";
import { GALATICOS_CLUB } from "../fixtures/clubs.js";

const club = (categories: string[]) => parseClubIdentity({ ...GALATICOS_CLUB, style: { categories } });

// Tabela sintética: isola a regra da média dos números reais dos perfis.
const byId = (profile: StyleProfile) => ({ [profile.id]: 2, shared: 2 });

describe("resolveProfileWeights", () => {
  it("returns the raw classic table when the club has no categories", () => {
    expect(resolveProfileWeights(club([]), byId)).toEqual({ classic: 2, shared: 2 });
  });

  it("averages the normalized tables of the listed profiles", () => {
    expect(resolveProfileWeights(club(["modern", "retro"]), byId)).toEqual({ modern: 0.25, shared: 0.5, retro: 0.25 });
  });

  it("treats a repeated category as one", () => {
    expect(resolveProfileWeights(club(["retro", "retro"]), byId)).toEqual({ retro: 0.5, shared: 0.5 });
  });

  it("ignores the club pattern weights", () => {
    const withPatternWeights = parseClubIdentity({ ...GALATICOS_CLUB, style: { categories: [], patternWeights: { solid: 1 } } });
    expect(resolveProfileWeights(withPatternWeights, byId)).toEqual({ classic: 2, shared: 2 });
  });
});
